import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { notifyBookingExpired } from '@/lib/line/notify'

// 沒人確認的預約要把時段放回去（規格 §4.3、§6.5）。
//
// 只有付費方案會產生「待確認」：免費方案沒有通知，客人根本不知道要確認，
// 所以那邊送出就直接成立。開始時間在 24 小時內的預約也直接成立——
// 否則釋出時間會晚於預約本身，那筆會永遠卡著（2026-08-02 補的洞）。
//
// ── 為什麼是一天跑一次，以及那樣為什麼還夠 ──────────────────
//
// Vercel 的 Hobby 方案限制排程一天只能觸發一次，所以不能每小時掃。
// 單靠「送出滿 24 小時就釋出」配上一天一次會留下一個洞：
//
//   週一 04:00 送出，約週二 05:00（25 小時後，所以要確認）
//   週二 03:00 掃描 → 才過 23 小時，不釋出
//   週二 05:00 預約時間到了，那筆還卡在待確認，時段整段鎖著沒人能約
//
// 所以第二個條件才是關鍵：**開始時間進入 12 小時內就直接釋出**。
// 因為送出時若在 24 小時內會直接成立（不會有 pending），
// 待確認的預約一定至少隔著一次掃描，這個洞就補起來了。
//
// 之後若升級 Vercel 方案，把 vercel.json 改回 `0 * * * *` 就會更即時。

/** 幾小時內沒確認就釋出。跟客人卡片上寫的「24 小時」是同一個數字 */
const CONFIRM_WINDOW_HOURS = 24

/** 剩這麼多小時還沒確認，不等滿 24 小時就先把時段放回去 */
const RELEASE_BEFORE_HOURS = 12

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()
  const cutoff = new Date(Date.now() - CONFIRM_WINDOW_HOURS * 3_600_000).toISOString()
  const soon = new Date(Date.now() + RELEASE_BEFORE_HOURS * 3_600_000).toISOString()

  // 兩種都要釋出：送出後超過確認期限的，以及時間快到了（或已經過了）
  // 卻還停在待確認的。第二條同時涵蓋「時間已經過去」的漏網之魚
  const { data, error } = await admin
    .from('bookings')
    .select('id, start_at, created_at')
    .eq('status', 'pending')
    .or(`created_at.lt.${cutoff},start_at.lt.${soon}`)

  if (error) {
    console.error('[cron] 讀不到待確認的預約', error.message)
    return NextResponse.json({ error: 'query failed' }, { status: 500 })
  }

  const released: string[] = []
  for (const booking of data ?? []) {
    // 逐筆更新並帶上 status 條件：客人可能就在這一秒按下確認，
    // 那一筆就不該被我們搶著釋出
    const { data: updated, error: updateError } = await admin
      .from('bookings')
      .update({ status: 'expired', closed_at: new Date().toISOString() })
      .eq('id', booking.id)
      .eq('status', 'pending')
      .select('id')

    if (updateError) {
      console.error('[cron] 釋出失敗', { bookingId: booking.id, message: updateError.message })
      continue
    }
    if (!updated?.length) continue

    released.push(booking.id)

    // 一定要告訴客人。安靜地釋出等於讓他抱著一筆不存在的預約來現場
    try {
      await notifyBookingExpired(booking.id)
    } catch (notifyError) {
      console.error('[cron] 釋出通知沒發出去', { bookingId: booking.id, notifyError })
    }
  }

  return NextResponse.json({ ok: true, released: released.length })
}
