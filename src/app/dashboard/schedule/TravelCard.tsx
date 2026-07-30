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

/** 不分方向的組合鍵，用來記「這一對要不要拆成兩個方向」 */
function pairKey(a: string, b: string) {
  return [a, b].sort().join('~')
}

/** 據點兩兩配對，每組只出現一次 */
function pairsOf(locations: Location[]): [Location, Location][] {
  const pairs: [Location, Location][] = []
  for (let i = 0; i < locations.length; i++) {
    for (let j = i + 1; j < locations.length; j++) {
      pairs.push([locations[i], locations[j]])
    }
  }
  return pairs
}

function DirectionRow({
  from,
  to,
  value,
  onChange,
}: {
  from: string
  to: string
  value: number | null
  onChange: (value: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="min-w-0 flex-1 text-[12px] font-bold text-ink-2">
        {from} → {to}
      </span>
      <NumberBox
        className="w-28 bg-card"
        value={value}
        onValueChange={onChange}
        min={0}
        step={5}
        suffix="分"
      />
    </div>
  )
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

  // 兩邊車程不一樣的組合。載入時若資料本來就不一樣，直接展開
  const [split, setSplit] = useState<Set<string>>(() => {
    const set = new Set<string>()
    for (const t of travel) {
      const back = travel.find(
        (x) => x.from_location_id === t.to_location_id && x.to_location_id === t.from_location_id
      )
      if (back && back.minutes !== t.minutes) set.add(pairKey(t.from_location_id, t.to_location_id))
    }
    return set
  })

  const showMatrix = locations.length >= 2

  /** 兩個方向一起填。想拆開的人自己按「兩邊不一樣」 */
  function setBoth(a: string, b: string, value: number) {
    setSaved(false)
    setMinutes((m) => ({ ...m, [key(a, b)]: value, [key(b, a)]: value }))
  }

  /** 單一方向。只有展開之後才用得到 */
  function setOne(from: string, to: string, value: number) {
    setSaved(false)
    setMinutes((m) => ({ ...m, [key(from, to)]: value }))
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
            <p className="mb-3.5 text-[12.5px] leading-relaxed text-ink-3">
              兩個據點之間開車要多久。系統會拿它算「這裡的預約結束後，最早幾點能在那裡開始」，
              填個保守值就好。
            </p>

            {/* 一行一組，不用矩陣：兩三個據點時矩陣反而難懂，
                而且「從↓到→」的方向感每次都要重新想一次 */}
            <ul className="flex flex-col gap-2.5">
              {pairsOf(locations).map(([a, b]) => {
                const pk = pairKey(a.id, b.id)
                const isSplit = split.has(pk)
                return (
                  <li key={pk} className="rounded-sm bg-sunk px-4 py-3.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <b className="min-w-0 flex-1 text-[13px] font-extrabold">
                        {a.name} <span className="text-ink-3">⇄</span> {b.name}
                      </b>

                      {isSplit ? (
                        <span className="text-[11.5px] font-bold text-ink-3">
                          兩個方向分開填
                        </span>
                      ) : (
                        <NumberBox
                          className="w-28 bg-card"
                          value={minutes[key(a.id, b.id)] ?? null}
                          onValueChange={(v) => setBoth(a.id, b.id, v)}
                          min={0}
                          step={5}
                          suffix="分"
                        />
                      )}

                      <button
                        onClick={() => {
                          const next = new Set(split)
                          if (isSplit) {
                            next.delete(pk)
                            // 收合時以 A→B 為準，把兩邊拉回同一個值
                            setBoth(a.id, b.id, minutes[key(a.id, b.id)] ?? 0)
                          } else {
                            next.add(pk)
                          }
                          setSplit(next)
                        }}
                        className="text-[11.5px] font-extrabold text-ink-3 hover:text-primary"
                      >
                        {isSplit ? '兩邊一樣' : '兩邊不一樣？'}
                      </button>
                    </div>

                    {isSplit && (
                      <div className="mt-3 flex flex-col gap-2">
                        <DirectionRow
                          from={a.name}
                          to={b.name}
                          value={minutes[key(a.id, b.id)] ?? null}
                          onChange={(v) => setOne(a.id, b.id, v)}
                        />
                        <DirectionRow
                          from={b.name}
                          to={a.name}
                          value={minutes[key(b.id, a.id)] ?? null}
                          onChange={(v) => setOne(b.id, a.id, v)}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
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
