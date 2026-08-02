import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { notifyBookingExpired } from '@/lib/line/notify'

// 沒人確認的預約要把時段放回去（規格 §4.3、§6.5）。
//
// 只有付費方案會產生「待確認」：免費方案沒有通知，客人根本不知道要確認，
// 所以那邊送出就直接成立。開始時間在 24 小時內的預約也直接成立——
// 否則釋出時間會晚於預約本身，那筆會永遠卡著（2026-08-02 補的洞）。
//
// 每小時跑一次，不是每天：每天跑的話一筆可能卡到 48 小時才釋出，
// 那個時段等於白白空了一天。

/** 幾小時內沒確認就釋出。跟客人卡片上寫的「24 小時」是同一個數字 */
const CONFIRM_WINDOW_HOURS = 24

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()
  const cutoff = new Date(Date.now() - CONFIRM_WINDOW_HOURS * 3_600_000).toISOString()
  const now = new Date().toISOString()

  // 兩種都要釋出：超過確認期限的，以及時間已經過了卻還停在待確認的
  const { data, error } = await admin
    .from('bookings')
    .select('id, start_at, created_at')
    .eq('status', 'pending')
    .or(`created_at.lt.${cutoff},start_at.lt.${now}`)

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
      .update({ status: 'expired', closed_at: now })
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
