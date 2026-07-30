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
    <main className="px-6 pt-2 pb-24">
      <div className="mb-5 flex items-baseline gap-3">
        <h1 className="text-[22px] font-extrabold tracking-tight">今日行程</h1>
        <span className="num text-xs font-bold text-ink-4">{label}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
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
                <span className="text-[11px] text-ink-4">{b.service_name}</span>
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
        <div className="mt-4 rounded-lg bg-card px-6 py-14 text-center shadow-card">
          <div className="mx-auto mb-4 size-14 rounded-lg bg-accent" />
          <b className="block text-[15px] font-extrabold">今天還沒有預約</b>
          <p className="mx-auto mt-1.5 max-w-[34ch] text-[13px] text-ink-3">
            把預約連結傳給客人，他們就能自己約。接到電話也可以自己建一筆。
          </p>
        </div>
      ) : (
        <ol className="mt-4 flex flex-col gap-2.5">
          {today.map((b, i) => {
            const prev = today[i - 1]
            const gap = prev ? travelBetween(prev, b, travel) : null
            const running = isInProgress(b)
            const location = locations.find((l) => l.id === b.location_id)

            return (
              <li key={b.id}>
                {gap && (
                  <p className="mb-2.5 flex flex-wrap items-center gap-x-2 px-1 text-[11px] font-bold text-ink-4">
                    <span className="num">
                      ↓ 移動 {gap.minutes} 分 · {gap.from} → {gap.to}
                    </span>
                    {location?.address && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-extrabold text-primary hover:underline"
                      >
                        開啟導航
                      </a>
                    )}
                  </p>
                )}

                <article
                  className={cn(
                    'rounded-lg bg-card px-4 py-3.5 shadow-soft',
                    running && 'shadow-[0_0_0_2px_var(--primary)]'
                  )}
                >
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <b className="num text-[15px] font-extrabold">
                      {formatTime(b.start_at, timezone)}
                    </b>
                    <b className="text-[14px] font-extrabold">
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

                  <p className="num mt-1 text-[11.5px] text-ink-3">
                    {[
                      b.service_name,
                      `${durationMinutes(b)} 分`,
                      b.location_name,
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

                  <div className="mt-2 flex flex-wrap items-center gap-2.5">
                    <span className="num text-[12.5px] font-extrabold">
                      {b.status === 'completed'
                        ? `實收 ${money(b.actual_amount)}`
                        : `現場付款 ${money(b.quoted_price)}`}
                    </span>
                    {b.kind === 'booking' &&
                      (b.status === 'confirmed' || b.status === 'pending') && (
                        <button
                          onClick={() => setCheckout(b)}
                          className="ml-auto rounded-full bg-sunk px-4 py-2 text-[11.5px] font-extrabold text-ink-2 transition hover:bg-accent hover:text-accent-foreground"
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
    <div className={cn('rounded-sm px-5 py-4', tone ? 'bg-warn-bg' : 'bg-sunk')}>
      <p className={cn('text-[11px] font-bold', tone ? 'text-warn' : 'text-ink-4')}>{label}</p>
      <p
        className={cn(
          'num mt-0.5 text-2xl leading-tight font-extrabold',
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
