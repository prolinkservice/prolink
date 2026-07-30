'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Bookable, BookableType, Location } from '@/lib/catalog'
import {
  Card,
  ErrorNote,
  Field,
  NumberBox,
  PrimaryButton,
  QuietButton,
  SelectBox,
  TextBox,
} from '@/components/FormBits'
import { saveBookable, setBookableActive } from './actions'

// 可預約標的（規格 §2.2）。師傅、包廂、場地、器材都是同一種東西，
// 差別只在 type 與容量。服務項目就是靠這些判斷時段能不能約。

const TYPE_LABEL: Record<BookableType, string> = {
  staff: '服務人員',
  space: '場地 / 包廂',
  equipment: '器材',
}

type ResourceDraft = {
  id?: string
  type: BookableType
  name: string
  locationId: string | null
  capacity: number
  hourlyPrice: number | null
}

export function ResourcesCard({
  bookables,
  locations,
}: {
  bookables: Bookable[]
  locations: Location[]
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<ResourceDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const active = bookables.filter((b) => b.is_active)
  const inactive = bookables.filter((b) => !b.is_active)

  function run(work: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null)
    startTransition(async () => {
      const res = await work()
      if (!res.ok) return setError(res.error)
      setDraft(null)
      router.refresh()
    })
  }

  return (
    <Card
      title="可預約的人與場地"
      sub={`${active.length} 項`}
      right={
        !draft && (
          <PrimaryButton
            onClick={() => {
              setError(null)
              setDraft({
                type: 'space',
                name: '',
                locationId: locations[0]?.id ?? null,
                capacity: 1,
                hourlyPrice: null,
              })
            }}
          >
            ＋ 新增場地或器材
          </PrimaryButton>
        )
      }
    >
      <div className="px-5 pt-1 pb-5">
        {/* 這一段是給「我建了據點，為什麼服務項目那邊沒出現」的人看的 */}
        <p className="mb-3 rounded-sm bg-sunk px-4 py-3 text-[11.5px] leading-relaxed text-ink-2">
          這裡列的是<b className="font-extrabold">同一個時間只能給一組客人用的東西</b>
          ：你本人、包廂、要出租的場地、特殊器材。服務項目就是靠它判斷時段會不會撞。
          <br />
          上面的「據點」只是地址，一個人跑兩個據點也<b className="font-extrabold">只算一個資源</b>
          （你自己），不用重複建立。
        </p>

        <ul className="flex flex-col">
          {active.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <b className="text-[13.5px] font-extrabold">{b.name}</b>
                  <span className="rounded-full bg-sunk px-2.5 py-0.5 text-[10px] font-extrabold text-ink-3">
                    {TYPE_LABEL[b.type]}
                  </span>
                </div>
                <p className="num text-[11.5px] text-ink-3">
                  {[
                    locations.find((l) => l.id === b.location_id)?.name ?? '不限地點',
                    b.capacity > 1 ? `可容納 ${b.capacity} 人` : null,
                    b.hourly_price
                      ? `NT$ ${Number(b.hourly_price).toLocaleString('zh-TW')} / 小時`
                      : null,
                  ]
                    .filter(Boolean)
                    .join('　·　')}
                </p>
              </div>
              <button
                onClick={() => {
                  setError(null)
                  setDraft({
                    id: b.id,
                    type: b.type,
                    name: b.name,
                    locationId: b.location_id,
                    capacity: b.capacity,
                    hourlyPrice: b.hourly_price,
                  })
                }}
                className="text-[11.5px] font-extrabold text-ink-3 hover:text-primary"
              >
                編輯
              </button>
              {/* 老師本人（staff）不給停用，停掉就沒人能被約了 */}
              {b.type !== 'staff' && (
                <button
                  onClick={() => run(() => setBookableActive(b.id, false))}
                  disabled={pending}
                  className="text-[12px] font-extrabold text-ink-3 hover:text-danger disabled:opacity-50"
                >
                  停用
                </button>
              )}
            </li>
          ))}
        </ul>

        {draft && (
          <div className="mt-3 rounded-sm bg-sunk px-4 pt-4 pb-3">
            <div className="grid gap-x-3.5 sm:grid-cols-2">
              <Field label="名稱">
                <TextBox
                  className="bg-card"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="包廂 A"
                />
              </Field>
              {draft.id ? (
                <Field label="類型">
                  <TextBox className="bg-card" value={TYPE_LABEL[draft.type]} disabled />
                </Field>
              ) : (
                <Field label="類型">
                  <SelectBox
                    className="bg-card"
                    value={draft.type}
                    onChange={(e) =>
                      setDraft({ ...draft, type: e.target.value as BookableType })
                    }
                  >
                    <option value="space">場地 / 包廂</option>
                    <option value="equipment">器材</option>
                  </SelectBox>
                </Field>
              )}
            </div>

            <div className="grid gap-x-3.5 sm:grid-cols-2">
              {locations.length > 0 && (
                <Field label="在哪個據點">
                  <SelectBox
                    className="bg-card"
                    value={draft.locationId ?? ''}
                    onChange={(e) =>
                      setDraft({ ...draft, locationId: e.target.value || null })
                    }
                  >
                    <option value="">不限地點</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </SelectBox>
                </Field>
              )}
              <Field
                label="可容納人數"
                hint="一次只服務一組客人就填 1。團課教室才需要填大一點。"
              >
                <NumberBox
                  className="bg-card"
                  value={draft.capacity}
                  onValueChange={(v) => setDraft({ ...draft, capacity: v })}
                  min={1}
                  step={1}
                  suffix="人"
                />
              </Field>
            </div>

            {/* 場租的價格綁在場地上：主訓練區與多功能教室可以不同價（規格 §10.2） */}
            {draft.type === 'space' && (
              <Field label="每小時租金" optional hint="出租場地才需要填，一般包廂留空">
                <NumberBox
                  className="bg-card"
                  value={draft.hourlyPrice}
                  onValueChange={(v) => setDraft({ ...draft, hourlyPrice: v })}
                  min={0}
                  step={50}
                  prefix="NT$"
                />
              </Field>
            )}

            <div className="flex gap-2">
              <PrimaryButton
                onClick={() =>
                  run(() =>
                    saveBookable({
                      id: draft.id,
                      type: draft.type,
                      name: draft.name,
                      locationId: draft.locationId,
                      capacity: draft.capacity,
                      hourlyPrice: draft.hourlyPrice,
                    })
                  )
                }
                disabled={pending}
              >
                {pending ? '儲存中…' : '儲存'}
              </PrimaryButton>
              <QuietButton onClick={() => setDraft(null)} disabled={pending}>
                取消
              </QuietButton>
            </div>
          </div>
        )}

        {inactive.length > 0 && (
          <div className="mt-4 border-t border-hairline pt-3">
            <p className="mb-2 text-[10px] font-extrabold tracking-[0.09em] text-ink-4">
              已停用
            </p>
            <ul className="flex flex-wrap gap-2">
              {inactive.map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => run(() => setBookableActive(b.id, true))}
                    disabled={pending}
                    className="rounded-full bg-sunk px-3.5 py-2 text-[11.5px] font-bold text-ink-3 transition hover:text-primary disabled:opacity-50"
                  >
                    {b.name} · 重新啟用
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ErrorNote>{error}</ErrorNote>
      </div>
    </Card>
  )
}
