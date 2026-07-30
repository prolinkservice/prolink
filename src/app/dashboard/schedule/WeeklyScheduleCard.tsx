'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  WEEKDAYS,
  toHHMM,
  type Bookable,
  type BusinessHour,
  type DaySegment,
  type Location,
} from '@/lib/catalog'
import {
  Card,
  ErrorNote,
  PrimaryButton,
  QuietButton,
  SelectBox,
} from '@/components/FormBits'
import { cn } from '@/lib/utils'
import { copyDayTo, saveDaySegments } from './actions'

// 每週排班。一格 = 「這個人這天在哪、幾點到幾點」，一天可以有多段，
// 各綁各的地點——固定型、彈性型、分時段型三種老師都是這張表的不同填法
// （規格 §8.5，草稿 docs/mockups/same-day-multi-site.html）

export function WeeklyScheduleCard({
  bookables,
  locations,
  hours,
}: {
  bookables: Bookable[]
  locations: Location[]
  hours: BusinessHour[]
}) {
  const router = useRouter()
  const [activeId, setActiveId] = useState(bookables[0]?.id ?? '')
  const [editing, setEditing] = useState<{ weekday: number; segments: DaySegment[] } | null>(
    null
  )
  const [copyTargets, setCopyTargets] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (bookables.length === 0) {
    return (
      <Card title="每週排班">
        <p className="px-5 pt-1 pb-5 text-[12.5px] text-ink-3">
          先建立可預約的人或場地，才能排班。
        </p>
      </Card>
    )
  }

  const active = bookables.find((b) => b.id === activeId) ?? bookables[0]

  function segmentsOf(weekday: number): DaySegment[] {
    return hours
      .filter((h) => h.bookable_id === active.id && h.weekday === weekday)
      .map((h) => ({
        start: toHHMM(h.start_time),
        end: toHHMM(h.end_time),
        locationId: h.location_id,
      }))
      .sort((a, b) => a.start.localeCompare(b.start))
  }

  function locationName(id: string | null): string {
    if (!id) return locations.length > 0 ? '不限地點' : ''
    return locations.find((l) => l.id === id)?.name ?? '已停用的據點'
  }

  function openDay(weekday: number) {
    setError(null)
    setCopyTargets([])
    const existing = segmentsOf(weekday)
    setEditing({
      weekday,
      segments: existing.length
        ? existing
        : [{ start: '10:00', end: '21:00', locationId: locations[0]?.id ?? null }],
    })
  }

  function run(work: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await work()
      if (!res.ok) return setError(res.error)
      setEditing(null)
      setCopyTargets([])
      router.refresh()
    })
  }

  return (
    <Card
      title="每週排班"
      sub={active.name}
      right={
        bookables.length > 1 && (
          <div className="flex gap-1 rounded-full bg-sunk p-1">
            {bookables.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setActiveId(b.id)
                  setEditing(null)
                }}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-[11.5px] font-extrabold transition',
                  b.id === active.id
                    ? 'bg-card text-ink shadow-soft'
                    : 'text-ink-3 hover:text-ink'
                )}
              >
                {b.name}
              </button>
            ))}
          </div>
        )
      }
    >
      <div className="px-5 pt-1 pb-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {WEEKDAYS.map((d) => {
            const segments = segmentsOf(d.value)
            const isEditing = editing?.weekday === d.value
            return (
              <button
                key={d.value}
                onClick={() => openDay(d.value)}
                className={cn(
                  'min-h-[76px] rounded-sm px-2.5 py-2.5 text-left transition',
                  isEditing
                    ? 'bg-primary text-primary-foreground'
                    : segments.length === 0
                      ? 'bg-sunk text-ink-4 hover:text-ink-3'
                      : 'bg-accent text-accent-foreground hover:brightness-[0.97]'
                )}
              >
                <b className="block text-[11px] font-extrabold">星期{d.label}</b>
                {segments.length === 0 ? (
                  <span className="text-[11.5px] font-bold">休</span>
                ) : (
                  <span className="mt-0.5 block">
                    {segments.map((s, i) => (
                      <span key={i} className="block text-[10.5px] leading-snug font-bold">
                        {locationName(s.locationId) && (
                          <span className="block truncate">{locationName(s.locationId)}</span>
                        )}
                        <span className="num opacity-80">
                          {s.start}–{s.end}
                        </span>
                      </span>
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {editing && (
          <div className="mt-3 rounded-sm bg-sunk px-4 pt-4 pb-4">
            <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2.5">
              <b className="text-[13.5px] font-extrabold">
                星期{WEEKDAYS.find((d) => d.value === editing.weekday)?.label}
              </b>
              <span className="text-[11.5px] text-ink-3">
                同一天可以排多段，各自綁不同據點；中間留白就是刻意不接客。
              </span>
            </div>

            <ul className="flex flex-col gap-2">
              {editing.segments.map((seg, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    step={1800}
                    value={seg.start}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        segments: editing.segments.map((s, j) =>
                          j === i ? { ...s, start: e.target.value } : s
                        ),
                      })
                    }
                    className="num rounded-sm bg-card px-3 py-2.5 text-[13px] font-extrabold outline-none"
                  />
                  <span className="text-[11.5px] font-bold text-ink-3">到</span>
                  <input
                    type="time"
                    step={1800}
                    value={seg.end}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        segments: editing.segments.map((s, j) =>
                          j === i ? { ...s, end: e.target.value } : s
                        ),
                      })
                    }
                    className="num rounded-sm bg-card px-3 py-2.5 text-[13px] font-extrabold outline-none"
                  />
                  {locations.length > 0 && (
                    <SelectBox
                      className="w-auto min-w-36 bg-card py-2.5"
                      value={seg.locationId ?? ''}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          segments: editing.segments.map((s, j) =>
                            j === i ? { ...s, locationId: e.target.value || null } : s
                          ),
                        })
                      }
                    >
                      <option value="">不限地點</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </SelectBox>
                  )}
                  <button
                    onClick={() =>
                      setEditing({
                        ...editing,
                        segments: editing.segments.filter((_, j) => j !== i),
                      })
                    }
                    className="text-[12px] font-extrabold text-ink-3 hover:text-danger"
                  >
                    移除
                  </button>
                </li>
              ))}
            </ul>

            <button
              onClick={() =>
                setEditing({
                  ...editing,
                  segments: [
                    ...editing.segments,
                    {
                      start: editing.segments.at(-1)?.end ?? '10:00',
                      end: '21:00',
                      locationId: locations[0]?.id ?? null,
                    },
                  ],
                })
              }
              className="mt-2.5 text-[11.5px] font-extrabold text-primary hover:underline"
            >
              ＋ 加一段時間
            </button>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <PrimaryButton
                onClick={() =>
                  run(() =>
                    saveDaySegments({
                      bookableId: active.id,
                      weekday: editing.weekday,
                      segments: editing.segments,
                    })
                  )
                }
                disabled={pending}
              >
                {pending ? '儲存中…' : '儲存這天'}
              </PrimaryButton>
              <QuietButton
                onClick={() =>
                  run(() =>
                    saveDaySegments({
                      bookableId: active.id,
                      weekday: editing.weekday,
                      segments: [],
                    })
                  )
                }
                disabled={pending}
              >
                這天休息
              </QuietButton>
              <QuietButton onClick={() => setEditing(null)} disabled={pending}>
                取消
              </QuietButton>
            </div>

            {/* 存好之後才有東西可以複製，所以放在最後面 */}
            <div className="mt-4 border-t border-hairline pt-3">
              <p className="mb-2 text-[11px] font-extrabold text-ink-2">
                把這天已存好的班複製到
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {WEEKDAYS.filter((d) => d.value !== editing.weekday).map((d) => {
                  const on = copyTargets.includes(d.value)
                  return (
                    <button
                      key={d.value}
                      onClick={() =>
                        setCopyTargets((t) =>
                          on ? t.filter((x) => x !== d.value) : [...t, d.value]
                        )
                      }
                      className={cn(
                        'min-w-9 rounded-full py-2 text-[11.5px] font-extrabold transition',
                        on
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card text-ink-3 shadow-soft hover:text-ink'
                      )}
                    >
                      {d.label}
                    </button>
                  )
                })}
                <QuietButton
                  className="ml-1"
                  disabled={pending || copyTargets.length === 0}
                  onClick={() =>
                    run(() =>
                      copyDayTo({
                        bookableId: active.id,
                        fromWeekday: editing.weekday,
                        toWeekdays: copyTargets,
                      })
                    )
                  }
                >
                  複製過去
                </QuietButton>
              </div>
              <p className="mt-2 text-[11.5px] text-ink-3">
                複製會覆蓋目標日原本的班。複製的是已儲存的內容，不是畫面上還沒存的修改。
              </p>
            </div>
          </div>
        )}

        <ErrorNote>{error}</ErrorNote>
      </div>
    </Card>
  )
}
