import { Card } from '@/components/FormBits'
import { cn } from '@/lib/utils'

// 訊息用量看板（規格 §9.2）。
//
// LINE 免費方案每月 200 則，系統自動發確認與提醒很容易爆量，
// 而職人是收到 LINE 帳單才發現。所以這個數字要一直看得到，
// 而且要講「照這個速度大概幾天後用完」——單看 164/200 沒有行動力。

export type UsageRow = { type: string; sent_at: string }

const FREE_QUOTA = 200

const TYPE_LABEL: Record<string, string> = {
  test: '測試訊息',
  booking_confirm_request: '請客人確認預約',
  booking_confirmed: '預約成立通知',
  booking_cancelled: '取消通知（發給客人）',
  new_booking_self: '新預約（發給你自己）',
  customer_cancelled_self: '客人取消（發給你自己）',
  reminder_evening: '行前提醒（前一天晚上）',
  reminder_soon: '行前提醒（出發前）',
  manual: '你自己手動發的',
}

export function UsageCard({
  month,
  rows,
  connected,
}: {
  month: string
  rows: UsageRow[]
  connected: boolean
}) {
  const used = rows.length
  const percent = Math.min(100, Math.round((used / FREE_QUOTA) * 100))
  const left = Math.max(0, FREE_QUOTA - used)

  const byType = new Map<string, number>()
  for (const row of rows) byType.set(row.type, (byType.get(row.type) ?? 0) + 1)
  const breakdown = [...byType.entries()].sort((a, b) => b[1] - a[1])

  const { daysLeft, perDay, runsOutIn } = pace(month, used)
  const tone = percent >= 80 ? 'bad' : percent >= 60 ? 'warn' : 'ok'

  return (
    <Card
      title="本月訊息用量"
      sub={`${Number(month.slice(5))} 月`}
      right={
        connected && (
          <span
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-extrabold',
              tone === 'bad'
                ? 'bg-danger-bg text-danger'
                : tone === 'warn'
                  ? 'bg-warn-bg text-warn'
                  : 'bg-ok-bg text-ok'
            )}
          >
            ● 已用 {percent}%
          </span>
        )
      }
    >
      <div className="px-5 pt-1 pb-5">
        {!connected ? (
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            接上官方帳號之後，這裡會顯示這個月發了幾則、還剩多少免費額度。
          </p>
        ) : (
          <>
            <div className="flex items-end gap-3">
              <span className="num text-[36px] leading-none font-extrabold">{used}</span>
              <span className="num pb-1 text-[13px] font-bold text-ink-3">
                / {FREE_QUOTA} 則　免費額度
              </span>
            </div>

            <div className="mt-3 h-3 overflow-hidden rounded-full bg-sunk">
              <div
                className={cn(
                  'h-full rounded-full',
                  tone === 'bad' ? 'bg-danger' : tone === 'warn' ? 'bg-warn' : 'bg-ok'
                )}
                style={{ width: `${Math.max(percent, 2)}%` }}
              />
            </div>

            <div className="num mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] font-semibold text-ink-3">
              <span>
                剩 <b className="text-ink">{left}</b> 則
              </span>
              <span>
                這個月還剩 <b className="text-ink">{daysLeft}</b> 天
              </span>
              <span>
                最近平均一天 <b className="text-ink">{perDay}</b> 則
              </span>
              {runsOutIn !== null && (
                <span className="font-extrabold text-warn">
                  照這個速度約 {runsOutIn} 天後用完
                </span>
              )}
            </div>

            {breakdown.length > 0 && (
              <ul className="mt-4 border-t border-hairline">
                {breakdown.map(([type, count]) => (
                  <li
                    key={type}
                    className="flex items-center gap-3 border-b border-hairline py-2.5 last:border-b-0"
                  >
                    <span className="text-[13px] font-semibold text-ink-2">
                      {TYPE_LABEL[type] ?? type}
                    </span>
                    <b className="num ml-auto text-[14px] font-extrabold">{count}</b>
                  </li>
                ))}
              </ul>
            )}

            {/* 這裡不該教職人「省到不敢發通知」。一個月做超過 50 筆的人一定會超過，
                正確答案是升級 LINE 自己的方案，不是關掉對客人有用的提醒 */}
            <p className="mt-3.5 text-[11.5px] leading-relaxed text-ink-3">
              一筆預約走完全程大約用掉 4 則，所以免費的 200 則大概夠 50 筆。
              超過之後每則依 LINE 官方計價，由 LINE 直接向你收費，我們不經手。
              <br />
              <b className="text-ink-2">一個月穩定超過的話，建議升級 LINE 官方帳號的輕用量方案</b>
              （月費約 NT$800，含 3,000 則），比一則一則計費划算很多。
              真的要省，可以關掉「有新預約時也通知我」，或把行前提醒只留出發前那一次。
            </p>
          </>
        )}
      </div>
    </Card>
  )
}

/**
 * 用「這個月已經過了幾天」推平均，而不是最近七天——
 * 月初資料太少時，七天平均會誇張到沒有意義。
 */
function pace(month: string, used: number) {
  const now = new Date()
  const year = Number(month.slice(0, 4))
  const monthIndex = Number(month.slice(5)) - 1
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const dayOfMonth = Math.min(now.getUTCDate(), daysInMonth)
  const daysLeft = daysInMonth - dayOfMonth

  const perDayRaw = used / Math.max(1, dayOfMonth)
  const perDay = perDayRaw >= 10 ? Math.round(perDayRaw) : Math.round(perDayRaw * 10) / 10
  const left = Math.max(0, FREE_QUOTA - used)
  const runsOutIn =
    perDayRaw > 0 && left / perDayRaw < daysLeft ? Math.max(1, Math.floor(left / perDayRaw)) : null

  return { daysLeft, perDay, runsOutIn }
}
