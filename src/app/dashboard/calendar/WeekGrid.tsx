'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  STATUS_LABEL,
  durationMinutes,
  money,
  type BookingRow,
} from '@/lib/bookings'
import { addDays, formatTime, minutesOfDay } from '@/lib/datetime'
import { cn } from '@/lib/utils'
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
}: {
  weekStart: string
  today: string
  bookings: BookingRow[]
  timezone: string
  services: ServiceOption[]
  locations: LocationInfo[]
}) {
  const [checkout, setCheckout] = useState<BookingRow | null>(null)
  const [creating, setCreating] = useState<{ date: string; time: string } | null>(null)

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
    <main className="px-6 pt-2 pb-10">
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-[22px] font-extrabold tracking-tight">行事曆</h1>
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

      <div className="overflow-x-auto rounded-lg bg-card p-3 shadow-card">
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
                  className="num text-right text-[10.5px] font-bold text-ink-4"
                  style={{ height: HOUR_PX }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {days.map((date) => {
              const dayBookings = bookings.filter((b) => dayOf(b.start_at) === date)
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
                    const dimmed =
                      b.status === 'cancelled' ||
                      b.status === 'expired' ||
                      b.status === 'no_show'
                    return (
                      <button
                        key={b.id}
                        onClick={() => b.kind === 'booking' && setCheckout(b)}
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

      <p className="mt-2 px-1 text-[11px] text-ink-4">
        本週共 {bookings.filter((b) => b.kind === 'booking').length} 筆，預計收入 NT${' '}
        {money(
          bookings
            .filter((b) => b.kind === 'booking' && b.status !== 'cancelled')
            .reduce((sum, b) => sum + Number(b.actual_amount ?? b.quoted_price ?? 0), 0)
        )}
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
    </main>
  )
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className={cn('block size-3 rounded-[4px]', tone)} />
      {label}
    </span>
  )
}
