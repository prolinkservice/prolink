'use client'

import { useState } from 'react'
import {
  STATUS_LABEL,
  STATUS_TONE,
  SOURCE_LABEL,
  durationMinutes,
  isInProgress,
  isLive,
  money,
  needsClosing,
  type BookingRow,
} from '@/lib/bookings'
import { formatDayLabel, formatTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { MapLink } from '@/components/MapLink'
import { CheckoutSheet } from './CheckoutSheet'
import { NewBookingSheet, type ServiceOption } from './NewBookingSheet'

// 今日行程。草稿：docs/mockups/dashboard.html §01
//
// 到府老師整天在外面，這頁一定要在手機上好用：
// 待結案排最上面（不催就沒有報表）、移動時間獨立一行（最常出的事就是低估車程）、
// 新增預約永遠在右下角（接到電話當下就要能登記）。

export type LocationInfo = { id: string; name: string; address: string | null }

export function TodayBoard({
  today,
  pendingClose,
  timezone,
  services,
  locations,
  travel,
  todayDate,
}: {
  today: BookingRow[]
  pendingClose: BookingRow[]
  timezone: string
  services: ServiceOption[]
  locations: LocationInfo[]
  /** `${from}|${to}` → 分鐘。查不到就不顯示移動時間，不亂猜 */
  travel: Record<string, number>
  todayDate: string
}) {
  const [checkout, setCheckout] = useState<BookingRow | null>(null)
  const [creating, setCreating] = useState(false)

  const live = today.filter(isLive)
  const expected = today
    .filter((b) => b.kind === 'booking' && b.status !== 'cancelled' && b.status !== 'no_show')
    .reduce((sum, b) => sum + Number(b.actual_amount ?? b.quoted_price ?? 0), 0)
  const toClose = [...pendingClose, ...today.filter((b) => needsClosing(b))]

  const label = formatDayLabel(todayDate)

  return (
    <main className="pb-24">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-[21px] font-extrabold tracking-tight">今日行程</h1>
        <span className="num text-[12.5px] font-bold text-ink-3">{label}</span>
      </div>

      {/* 三個數字併成一張卡，上緣壓一條刻度——這是全站的招牌圖形。
          三個獨立色塊各自搶注意力，合起來反而安靜 */}
      <div className="relative flex flex-wrap overflow-hidden rounded-lg bg-card shadow-soft">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1.5"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, var(--hairline) 0 1px, transparent 1px 11px)',
          }}
        />
        <Stat label="今日預約" value={String(live.length)} />
        <Stat label="預計收入" value={`NT$ ${money(expected)}`} />
        <Stat label="待結案" value={String(toClose.length)} tone={toClose.length > 0} />
      </div>

      {toClose.length > 0 && (
        <section className="mt-4 rounded-lg bg-warn-bg px-4 py-3.5">
          <b className="block text-[13px] font-extrabold text-warn">
            有 {toClose.length} 筆預約還沒結案
          </b>
          <p className="mt-0.5 mb-2.5 text-[11.5px] font-semibold text-warn">
            登記有沒有到、實收多少，報表才有數字。
          </p>
          <ul className="flex flex-col gap-1.5">
            {toClose.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-sm bg-card px-3.5 py-2.5"
              >
                <span className="num text-[11.5px] font-extrabold text-ink-3">
                  {formatDate(b.start_at, timezone)} {formatTime(b.start_at, timezone)}
                </span>
                <b className="text-[13px] font-extrabold">{b.customer_name ?? '—'}</b>
                <span className="text-[11.5px] text-ink-3">{b.service_name}</span>
                <button
                  onClick={() => setCheckout(b)}
                  className="ml-auto rounded-full bg-primary px-4 py-1.5 text-[11.5px] font-extrabold text-primary-foreground"
                >
                  去結案
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {today.length === 0 ? (
        <div className="mt-3.5 flex flex-wrap items-center gap-4 rounded-lg bg-card px-5 py-6 shadow-soft">
          <div className="size-11 shrink-0 rounded-md bg-accent" />
          <div className="min-w-[16ch] flex-1">
            <b className="block text-[14.5px] font-extrabold">今天還沒有預約</b>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
              把預約連結傳給客人，他們就能自己約；接到電話也可以自己建一筆。
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="shrink-0 rounded-full bg-primary px-5 py-3 text-[12.5px] font-extrabold text-primary-foreground transition hover:brightness-95"
          >
            ＋ 新增預約
          </button>
        </div>
      ) : (
        <ol className="relative mt-4 flex flex-col gap-2.5 pl-14 before:absolute before:top-3 before:bottom-3 before:left-[46px] before:w-px before:bg-hairline">
          {/* 左邊那條線加每筆的時間，就是一把刻度尺：
              時間離開卡片、變成行程的骨架 */}
          {today.map((b, i) => {
            const prev = today[i - 1]
            const gap = prev ? travelBetween(prev, b, travel) : null
            const running = isInProgress(b)
            const location = locations.find((l) => l.id === b.location_id)

            return (
              <li key={b.id} className="relative">
                {gap && (
                  <p className="num mb-2.5 text-[11.5px] font-bold text-ink-3">
                    ↓ 移動 {gap.minutes} 分 · {gap.from} → {gap.to}
                  </p>
                )}

                <span
                  aria-hidden
                  className={cn(
                    'absolute -left-14 w-[46px] pr-3 text-right',
                    gap ? 'top-[46px]' : 'top-3.5'
                  )}
                >
                  <b className="num block text-[15px] leading-none font-extrabold">
                    {formatTime(b.start_at, timezone)}
                  </b>
                  <small className="num mt-1 block text-[10.5px] text-ink-3">
                    {durationMinutes(b)} 分
                  </small>
                </span>

                <article
                  className={cn(
                    'rounded-lg bg-card px-4 py-3.5 shadow-soft',
                    running && 'border-l-[3px] border-primary shadow-card'
                  )}
                >
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <b className="text-[14.5px] font-extrabold">
                      {b.kind === 'block' ? '不開放' : (b.customer_name ?? '—')}
                    </b>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[10px] font-extrabold',
                        running ? 'bg-primary text-primary-foreground' : STATUS_TONE[b.status]
                      )}
                    >
                      {running ? '進行中' : STATUS_LABEL[b.status]}
                    </span>
                    {b.source !== 'manual' && b.source !== 'online' && (
                      <span className="rounded-full bg-info-bg px-2.5 py-0.5 text-[10px] font-extrabold text-info">
                        {SOURCE_LABEL[b.source]}
                      </span>
                    )}
                    {b.customer_no_show_points > 0 && (
                      <span className="num rounded-full bg-danger-bg px-2.5 py-0.5 text-[10px] font-extrabold text-danger">
                        放鳥 {b.customer_no_show_points} 點
                      </span>
                    )}
                  </div>

                  {/* 時長已經在左邊的刻度上，這裡不再重複。
                      到府的預約沒有據點，地址在預約本身上——而且要顯示完整的，
                      導航會把樓層砍掉，老師到了樓下還是得知道上幾樓 */}
                  <p className="num mt-1 text-[11.5px] text-ink-3">
                    {[
                      b.service_name,
                      b.location_name ?? b.service_address,
                      b.customer_phone,
                    ]
                      .filter(Boolean)
                      .join('　·　')}
                  </p>

                  {b.note && (
                    <p className="mt-1.5 rounded-sm bg-sunk px-3 py-2 text-[11.5px] text-ink-2">
                      {b.note}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="num mr-1 text-[12.5px] font-extrabold">
                      {b.status === 'completed'
                        ? `實收 ${money(b.actual_amount)}`
                        : `現場付款 ${money(b.quoted_price)}`}
                    </span>

                    {/* 導航不綁在「有移動時間」上：第一筆、單據點、還沒填車程的人
                        一樣要出得了門。只要這個據點有地址就給得出來 */}
                    <MapLink address={location?.address} label="導航" />

                    {/* 到府服務的地址在預約上，不在據點上 */}
                    <MapLink address={b.service_address} label="到府地址" />

                    {b.kind === 'booking' &&
                      (b.status === 'confirmed' || b.status === 'pending') && (
                        <button
                          onClick={() => setCheckout(b)}
                          className="ml-auto min-h-11 rounded-full bg-sunk px-4 text-[12px] font-extrabold text-ink-2 transition hover:bg-accent hover:text-accent-foreground"
                        >
                          結案
                        </button>
                      )}
                  </div>
                </article>
              </li>
            )
          })}
        </ol>
      )}

      <button
        onClick={() => setCreating(true)}
        className="fixed right-6 bottom-6 z-40 rounded-full bg-primary px-6 py-4 text-[13.5px] font-extrabold text-primary-foreground shadow-float transition hover:brightness-95"
      >
        ＋ 新增預約
      </button>

      {creating && (
        <NewBookingSheet
          services={services}
          locations={locations}
          timezone={timezone}
          initialDate={todayDate}
          onClose={() => setCreating(false)}
        />
      )}

      {checkout && (
        <CheckoutSheet
          booking={checkout}
          timezone={timezone}
          onClose={() => setCheckout(null)}
        />
      )}
    </main>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: boolean }) {
  return (
    <div
      className={cn(
        'min-w-[33%] flex-1 border-hairline px-5 py-3.5 not-[:last-child]:border-r',
        tone && 'bg-warn-bg'
      )}
    >
      <p className={cn('text-[11.5px] font-bold', tone ? 'text-warn' : 'text-ink-3')}>
        {label}
      </p>
      <p
        className={cn(
          'num mt-0.5 text-[23px] leading-tight font-extrabold tracking-[-0.03em]',
          tone && 'text-warn'
        )}
      >
        {value}
      </p>
    </div>
  )
}

/**
 * 兩筆之間要不要顯示移動時間。同一個地點不顯示，
 * 查不到車程也不顯示——寧可不講，也不要給老師一個亂猜的數字。
 */
function travelBetween(
  prev: BookingRow,
  next: BookingRow,
  travel: Record<string, number>
): { minutes: number; from: string; to: string } | null {
  if (!prev.location_id || !next.location_id) return null
  if (prev.location_id === next.location_id) return null
  const minutes = travel[`${prev.location_id}|${next.location_id}`]
  if (!minutes) return null
  return {
    minutes,
    from: prev.location_name ?? '上一個地點',
    to: next.location_name ?? '下一個地點',
  }
}

function formatDate(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: timezone,
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}
