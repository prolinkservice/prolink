import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { notifyReminder } from '@/lib/line/notify'

// 行前提醒（規格 §6.5）。草稿：docs/mockups/booking-reminders.html
//
// 每天台北時間中午 12:00 跑一次（vercel.json 寫 UTC 的 `0 4 * * *`）。
// 跟夯客同一個節奏——客人在前一天中午收到，還有一整個下午可以說他不能來，
// 那個時段就賣得掉；等到當天早上才提醒，那一格通常補不到人。
//
// ── 為什麼往前看 36 小時而不是「掃明天整天」──────────────────
//
// 正常情況下兩種寫法結果一樣（中午 12:00 往後 36 小時 = 明天一整天），
// 但 36 小時的寫法多做到兩件事：
//
//   ① 臨時成立的補得到。昨天中午之後才約的「明天早上」，昨天那次掃描時
//      還不存在，今天中午這次仍然撈得到（雖然只剩幾小時，總比沒有好）
//   ② 排程漏跑一天不會整批消失。隔天補跑時，還沒開始的照樣發得出去
//
// 代價是提醒的提前量不固定，落在開始前 12–36 小時之間。
// 之後若改成每小時跑，把這個數字調小就會變準，這支程式不用改。

/** 往前看多久。36 = 24（下次掃描）+ 12（那次掃描來不及的緩衝） */
const LOOK_AHEAD_HOURS = 36

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()
  const now = new Date()
  const horizon = new Date(now.getTime() + LOOK_AHEAD_HOURS * 3_600_000)

  const { data, error } = await admin
    .from('bookings')
    .select('id')
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .gt('start_at', now.toISOString())
    .lte('start_at', horizon.toISOString())
    .order('start_at')

  if (error) {
    console.error('[cron] 讀不到要提醒的預約', error.message)
    return NextResponse.json({ error: 'query failed' }, { status: 500 })
  }

  const count = { sent: 0, failed: 0, off: 0, skip: 0 }

  for (const booking of data ?? []) {
    let result: 'sent' | 'failed' | 'off' | 'skip'
    try {
      result = await notifyReminder(booking.id)
    } catch (sendError) {
      console.error('[cron] 提醒發送時出錯', { bookingId: booking.id, sendError })
      result = 'failed'
    }
    count[result]++

    // 關掉提醒的那些不蓋章：職人明天打開，明天中午這批還來得及發。
    // 其餘一律蓋章，包含發失敗的——下一次掃描是 24 小時後，
    // 那時候多半已經來不及，與其每天重試不如留在 log 裡
    if (result === 'off') continue

    const { error: stampError } = await admin
      .from('bookings')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', booking.id)

    if (stampError) {
      console.error('[cron] 提醒記不起來，明天會再發一次', {
        bookingId: booking.id,
        message: stampError.message,
      })
    }
  }

  return NextResponse.json({ ok: true, ...count })
}
