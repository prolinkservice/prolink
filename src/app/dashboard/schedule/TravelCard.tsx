'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Bookable, Location, TravelTime } from '@/lib/catalog'
import { Card, ErrorNote, NumberBox, PrimaryButton } from '@/components/FormBits'
import { saveBookableTravel, saveTravelTimes } from './actions'

// 據點之間的移動時間。判斷條件是「據點數量」，不是服務怎麼設定——
// 只要有兩個以上據點，老師就可能同一天跑兩地（規格 §8.3）。
//
// 間隔用相加不取大值：收拾完才能上路，到了還要準備（規格 §8.4）。

function key(from: string, to: string) {
  return `${from}|${to}`
}

export function TravelCard({
  locations,
  bookables,
  travel,
  hasMobileService,
}: {
  locations: Location[]
  bookables: Bookable[]
  travel: TravelTime[]
  hasMobileService: boolean
}) {
  const router = useRouter()
  const [minutes, setMinutes] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const t of travel) map[key(t.from_location_id, t.to_location_id)] = t.minutes
    return map
  })
  const [travelDefaults, setTravelDefaults] = useState<
    Record<string, { cross: number; mobile: number }>
  >(() => {
    const map: Record<string, { cross: number; mobile: number }> = {}
    for (const b of bookables) {
      map[b.id] = { cross: b.cross_site_travel_min, mobile: b.default_travel_min }
    }
    return map
  })
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const showMatrix = locations.length >= 2

  function setPair(from: string, to: string, value: number) {
    setSaved(false)
    // 預設兩邊同值。單行道或固定塞車方向想拆開，改另一格就好
    setMinutes((m) => {
      const next = { ...m, [key(from, to)]: value }
      if (next[key(to, from)] === undefined) next[key(to, from)] = value
      return next
    })
  }

  function run(work: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await work()
      if (!res.ok) return setError(res.error)
      setSaved(true)
      router.refresh()
    })
  }

  function saveMatrix() {
    const entries = Object.entries(minutes)
      .map(([k, value]) => {
        const [fromLocationId, toLocationId] = k.split('|')
        return { fromLocationId, toLocationId, minutes: value }
      })
      .filter((e) => Number.isFinite(e.minutes))
    run(() => saveTravelTimes(entries))
  }

  return (
    <Card title="移動時間" sub="分鐘">
      <div className="px-5 pt-1 pb-5">
        {showMatrix && (
          <>
            <p className="mb-3 text-[12.5px] text-ink-3">
              系統會拿這些數字算「A 館的預約結束後，最早幾點能在 B 館開始」。
              你自己最清楚車程，填個保守值就好。
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-[10.5px] font-extrabold text-ink-4">
                      從 ↓ 到 →
                    </th>
                    {locations.map((l) => (
                      <th
                        key={l.id}
                        className="p-2 text-[10.5px] font-extrabold text-ink-4"
                      >
                        {l.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {locations.map((from) => (
                    <tr key={from.id} className="border-b border-hairline last:border-b-0">
                      <th className="p-2 text-left text-[12px] font-extrabold text-ink-2">
                        {from.name}
                      </th>
                      {locations.map((to) => (
                        <td key={to.id} className="p-2 text-center">
                          {from.id === to.id ? (
                            <span className="text-[12px] font-bold text-ink-4">—</span>
                          ) : (
                            <NumberBox
                              className="mx-auto w-20"
                              value={minutes[key(from.id, to.id)] ?? null}
                              onValueChange={(v) => setPair(from.id, to.id, v)}
                              min={0}
                              step={5}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-2.5">
              <PrimaryButton onClick={saveMatrix} disabled={pending}>
                {pending ? '儲存中…' : '儲存移動時間'}
              </PrimaryButton>
              {saved && (
                <span className="text-[11.5px] font-extrabold text-ok">已儲存</span>
              )}
            </div>
          </>
        )}

        {hasMobileService && bookables.length > 0 && (
          <div className={showMatrix ? 'mt-5 border-t border-hairline pt-4' : ''}>
            <b className="block text-[13px] font-extrabold">到府每趟預留</b>
            <p className="mt-0.5 mb-3 text-[11.5px] text-ink-3">
              到府沒有固定據點，車程算不準，所以用一個固定值預留。覺得不夠可以調大。
            </p>
            <ul className="flex flex-col gap-2.5">
              {bookables.map((b) => {
                const value = travelDefaults[b.id] ?? {
                  cross: b.cross_site_travel_min,
                  mobile: b.default_travel_min,
                }
                return (
                  <li key={b.id} className="flex flex-wrap items-center gap-2.5">
                    <span className="min-w-20 text-[12.5px] font-extrabold text-ink-2">
                      {b.name}
                    </span>
                    <NumberBox
                      className="w-32"
                      value={value.mobile}
                      onValueChange={(v) => {
                        setSaved(false)
                        setTravelDefaults((m) => ({ ...m, [b.id]: { ...value, mobile: v } }))
                      }}
                      min={0}
                      step={5}
                      suffix="分"
                    />
                    <PrimaryButton
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          saveBookableTravel({
                            bookableId: b.id,
                            crossSiteTravelMin: value.cross,
                            defaultTravelMin: value.mobile,
                          })
                        )
                      }
                    >
                      儲存
                    </PrimaryButton>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <ErrorNote>{error}</ErrorNote>
      </div>
    </Card>
  )
}
