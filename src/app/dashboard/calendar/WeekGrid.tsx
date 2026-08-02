'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  STATUS_LABEL,
  STATUS_TONE,
  canCancel,
  countsTowardRevenue,
  durationMinutes,
  isDropped,
  money,
  type BookingRow,
} from '@/lib/bookings'
import { addDays, formatTime, minutesOfDay } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { CancelSheet } from '../CancelSheet'
import { CheckoutSheet } from '../CheckoutSheet'
import { NewBookingSheet, type ServiceOption } from '../NewBookingSheet'
import type { LocationInfo } from '../TodayBoard'

// 週檢視。草稿：docs/mockups/dashboard.html §02
//
// 拖曳改時間留到之後：先讓老師看得到整週的滿載程度，
// 以及點空白處直接在那個時段建單——這兩件事就佔了九成的用途。

const START_HOUR = 8
const END_HOUR = 23
const HOUR_PX = 52

export function WeekGrid({
  weekStart,
  today,
  bookings,
  timezone,
  services,
  locations,
  refundableHours,
}: {
  weekStart: string
  today: string
  bookings: BookingRow[]
  timezone: string
  services: ServiceOption[]
  locations: LocationInfo[]
  refundableHours: number
}) {
  const [checkout, setCheckout] = useState<BookingRow | null>(null)
  const [cancelling, setCancelling] = useState<BookingRow | null>(null)
  const [creating, setCreating] = useState<{ date: string; time: string } | null>(null)
  // 手機版一次只看一天。預設落在今天，翻到別週時落在那一週的第一天
  const [selected, setSelected] = useState(
    today >= weekStart && today <= addDays(weekStart, 6) ? today : weekStart
  )

  // 取消的雖然不畫在格子上，還是要讓老師知道「這週有人退掉」
  const dropped = bookings.filter((b) => b.kind === 'booking' && isDropped(b)).length

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  function dayOf(iso: string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso))
  }

  return (
    <main className="pb-10">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-[21px] font-extrabold tracking-tight">行事曆</h1>
        <span className="num text-xs font-bold text-ink-4">
          {weekStart.slice(5).replace('-', '/')} – {addDays(weekStart, 6).slice(5).replace('-', '/')}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/dashboard/calendar?week=${addDays(weekStart, -7)}`}
            className="rounded-full bg-sunk px-4 py-2 text-[12px] font-extrabold text-ink-2"
          >
            ‹ 上週
          </Link>
          <Link
            href={`/dashboard/calendar?week=${today}`}
            className="rounded-full bg-sunk px-4 py-2 text-[12px] font-extrabold text-ink-2"
          >
            本週
          </Link>
          <Link
            href={`/dashboard/calendar?week=${addDays(weekStart, 7)}`}
            className="rounded-full bg-sunk px-4 py-2 text-[12px] font-extrabold text-ink-2"
          >
            下週 ›
          </Link>
        </div>
      </div>

      {/* 手機一天一格，電腦維持七欄併排。
          這兩件事本來就不一樣：手機是在外面看「等一下要去哪」，一次只需要一天；
          電腦是坐下來排下週的班，需要一次看到七天怎麼疊 */}
      <DayList
        days={days}
        today={today}
        selected={selected}
        onSelect={setSelected}
        bookings={bookings}
        timezone={timezone}
        dayOf={dayOf}
        onCreate={(time) => setCreating({ date: selected, time })}
        onOpen={(b) => (canCancel(b) ? setCancelling(b) : setCheckout(b))}
      />

      <div className="hidden overflow-x-auto rounded-lg bg-card p-3 shadow-card md:block">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[52px_repeat(7,1fr)] gap-1.5 pb-2">
            <span />
            {days.map((d) => (
              <div
                key={d}
                className={cn(
                  'rounded-sm py-1.5 text-center',
                  d === today ? 'bg-accent text-accent-foreground' : 'bg-sunk'
                )}
              >
                <span className="block text-[10px] font-extrabold opacity-70">
                  {'日一二三四五六'[new Date(`${d}T00:00:00Z`).getUTCDay()]}
                </span>
                <span className="num block text-[14px] font-extrabold">
                  {Number(d.slice(8, 10))}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[52px_repeat(7,1fr)] gap-1.5">
            <div>
              {hours.map((h) => (
                <div
                  key={h}
                  className="num text-right text-[11px] font-bold text-ink-3"
                  style={{ height: HOUR_PX }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {days.map((date) => {
              // 取消掉的不畫。那一格已經還回去了，畫著會讓人以為還被佔著
              const dayBookings = bookings.filter(
                (b) => dayOf(b.start_at) === date && !isDropped(b)
              )
              return (
                <div
                  key={date}
                  className="relative rounded-sm bg-sunk"
                  style={{ height: hours.length * HOUR_PX }}
                >
                  {hours.map((h) => (
                    <button
                      key={h}
                      onClick={() => setCreating({ date, time: `${String(h).padStart(2, '0')}:00` })}
                      title={`在 ${date} ${h}:00 建立預約`}
                      className="absolute inset-x-0 border-t border-hairline/70 transition hover:bg-accent/40"
                      style={{ top: (h - START_HOUR) * HOUR_PX, height: HOUR_PX }}
                    />
                  ))}

                  {dayBookings.map((b) => {
                    const top =
                      ((minutesOfDay(b.start_at, timezone) - START_HOUR * 60) / 60) * HOUR_PX
                    const height = Math.max((durationMinutes(b) / 60) * HOUR_PX - 3, 22)
                    // 取消的已經在上面濾掉了，剩下會淡化的只有放鳥——
                    // 那筆時間確實被佔用過，所以留在格子上
                    const dimmed = b.status === 'no_show'
                    return (
                      <button
                        key={b.id}
                        // 還沒開始的點開是「要不要取消」，開始過的點開是「結案」。
                        // 同一格在不同時間點該做的事本來就不一樣
                        onClick={() =>
                          b.kind === 'booking' &&
                          (canCancel(b) ? setCancelling(b) : setCheckout(b))
                        }
                        className={cn(
                          'absolute inset-x-1 overflow-hidden rounded-[10px] px-2 py-1.5 text-left',
                          b.kind === 'block'
                            ? 'bg-danger-bg text-danger'
                            : b.status === 'pending'
                              ? 'bg-info-bg text-info'
                              : b.status === 'completed'
                                ? 'bg-sunk text-ink-3 shadow-soft'
                                : 'bg-accent text-accent-foreground',
                          dimmed && 'opacity-55 line-through'
                        )}
                        style={{ top: Math.max(top, 0), height }}
                      >
                        <b className="num block text-[10.5px] leading-tight font-extrabold">
                          {formatTime(b.start_at, timezone)}
                        </b>
                        <span className="block truncate text-[11px] leading-tight font-extrabold">
                          {b.kind === 'block' ? '不開放' : (b.customer_name ?? '—')}
                        </span>
                        <span className="block truncate text-[10px] leading-tight opacity-80">
                          {[b.service_name, b.location_name].filter(Boolean).join(' · ')}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[11px] font-bold text-ink-3">
        <Legend tone="bg-accent" label={STATUS_LABEL.confirmed} />
        <Legend tone="bg-info-bg" label={STATUS_LABEL.pending} />
        <Legend tone="bg-sunk" label={STATUS_LABEL.completed} />
        <Legend tone="bg-danger-bg" label="不開放" />
        <span className="text-ink-4">點空白處可以直接在那個時段建立預約</span>
      </div>

      <p className="mt-2 px-1 text-[11.5px] text-ink-3">
        本週共 {bookings.filter((b) => b.kind === 'booking' && !isDropped(b)).length} 筆，
        預計收入 NT${' '}
        {money(
          bookings
            .filter(countsTowardRevenue)
            .reduce((sum, b) => sum + Number(b.actual_amount ?? b.quoted_price ?? 0), 0)
        )}
        {dropped > 0 && `　·　另有 ${dropped} 筆已取消`}
      </p>

      {creating && (
        <NewBookingSheet
          services={services}
          locations={locations}
          timezone={timezone}
          initialDate={creating.date}
          initialTime={creating.time}
          onClose={() => setCreating(null)}
        />
      )}

      {checkout && (
        <CheckoutSheet
          booking={checkout}
          timezone={timezone}
          onClose={() => setCheckout(null)}
        />
      )}

      {cancelling && (
        <CancelSheet
          booking={cancelling}
          timezone={timezone}
          refundableHours={refundableHours}
          onClose={() => setCancelling(null)}
        />
      )}
    </main>
  )
}

/** 兩筆之間至少空這麼久才值得提「這裡還空著」 */
const GAP_MIN = 30

/**
 * 手機版：先選一天，再看那天的完整行程。
 * 草稿：docs/mockups/calendar-mobile.html
 *
 * 長相刻意跟「今日行程」一樣——時間刻在左邊、卡片整寬、
 * 移動時間獨立一行。行事曆點任何一天，就等於那天的今日行程，
 * 少學一套介面。
 */
function DayList({
  days,
  today,
  selected,
  onSelect,
  bookings,
  timezone,
  dayOf,
  onCreate,
  onOpen,
}: {
  days: string[]
  today: string
  selected: string
  onSelect: (date: string) => void
  bookings: BookingRow[]
  timezone: string
  dayOf: (iso: string) => string
  onCreate: (time: string) => void
  onOpen: (b: BookingRow) => void
}) {
  const ofDay = (date: string) =>
    bookings
      .filter((b) => dayOf(b.start_at) === date && !isDropped(b))
      .sort((a, b) => a.start_at.localeCompare(b.start_at))

  const list = ofDay(selected)

  return (
    <div className="md:hidden">
      <div className="mb-3 flex gap-1.5">
        {days.map((d) => {
          const count = ofDay(d).length
          const on = d === selected
          return (
            <button
              key={d}
              onClick={() => onSelect(d)}
              className={cn(
                'flex-1 rounded-sm py-2 text-center transition',
                on ? 'bg-primary text-primary-foreground shadow-card' : 'bg-card shadow-soft'
              )}
            >
              <span className={cn('block text-[9.5px] font-extrabold', !on && 'text-ink-3')}>
                {'日一二三四五六'[new Date(`${d}T00:00:00Z`).getUTCDay()]}
              </span>
              <span className="num block text-[16px] leading-tight font-extrabold">
                {Number(d.slice(8, 10))}
              </span>
              {/* 圓點＝那天有幾筆。不用讀數字就知道忙不忙，滿了自然看起來很密 */}
              <span className="mt-1 flex h-1 justify-center gap-[3px]">
                {Array.from({ length: Math.min(count, 4) }, (_, i) => (
                  <i
                    key={i}
                    className={cn(
                      'size-1 rounded-full',
                      on ? 'bg-primary-foreground' : 'bg-primary'
                    )}
                  />
                ))}
              </span>
              {d === today && (
                <span className={cn('block text-[8.5px] font-extrabold', !on && 'text-primary')}>
                  今天
                </span>
              )}
            </button>
          )
        })}
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg bg-card px-5 py-8 text-center shadow-soft">
          <b className="block text-[14px] font-extrabold">這天還沒有預約</b>
          <button
            onClick={() => onCreate('10:00')}
            className="mt-3 rounded-full bg-primary px-5 py-2.5 text-[12.5px] font-extrabold text-primary-foreground"
          >
            ＋ 在這天建立預約
          </button>
        </div>
      ) : (
        <ol className="relative flex flex-col gap-2 pl-14 before:absolute before:top-3 before:bottom-3 before:left-[46px] before:w-px before:bg-hairline">
          {list.map((b, i) => {
            const prev = list[i - 1]
            const gap = prev ? freeGap(prev, b, timezone) : null
            return (
              <li key={b.id} className="relative">
                {/* 空檔獨立一列、整列可點。在小格子上瞄準一個空白處
                    在手機上根本按不準 */}
                {gap && (
                  <button
                    onClick={() => onCreate(gap.from)}
                    className="num mb-2 block w-full rounded-sm bg-sunk py-2 text-center text-[11.5px] font-bold text-ink-3"
                  >
                    {gap.from}–{gap.to} 還空著 · 點一下建立預約
                  </button>
                )}

                <span
                  aria-hidden
                  className={cn('absolute -left-14 w-[46px] pr-3 text-right', gap ? 'top-11' : 'top-3.5')}
                >
                  <b className="num block text-[15px] leading-none font-extrabold">
                    {formatTime(b.start_at, timezone)}
                  </b>
                  <small className="num mt-1 block text-[10.5px] text-ink-3">
                    {durationMinutes(b)} 分
                  </small>
                </span>

                <button
                  onClick={() => b.kind === 'booking' && onOpen(b)}
                  className="block w-full rounded-lg bg-card px-4 py-3 text-left shadow-soft"
                >
                  <b className="text-[14px] font-extrabold">
                    {b.kind === 'block' ? '不開放' : (b.customer_name ?? '—')}
                  </b>
                  <span
                    className={cn(
                      'ml-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold',
                      STATUS_TONE[b.status]
                    )}
                  >
                    {STATUS_LABEL[b.status]}
                  </span>
                  <p className="num mt-0.5 text-[11.5px] text-ink-3">
                    {[b.service_name, b.location_name ?? b.service_address, b.customer_phone]
                      .filter(Boolean)
                      .join('　·　')}
                  </p>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

/** 兩筆之間空得下東西嗎。空太短就不提，提了也約不進去 */
function freeGap(
  prev: BookingRow,
  next: BookingRow,
  timezone: string
): { from: string; to: string } | null {
  const minutes = (new Date(next.start_at).getTime() - new Date(prev.end_at).getTime()) / 60000
  if (minutes < GAP_MIN) return null
  return { from: formatTime(prev.end_at, timezone), to: formatTime(next.start_at, timezone) }
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className={cn('block size-3 rounded-[4px]', tone)} />
      {label}
    </span>
  )
}
