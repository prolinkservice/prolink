'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Location, LocationType } from '@/lib/catalog'
import {
  Card,
  ErrorNote,
  Field,
  PrimaryButton,
  QuietButton,
  SelectBox,
  TextBox,
} from '@/components/FormBits'
import { saveLocation, setLocationActive } from './actions'

// 據點。單人單店的老師只會看到一列，也不需要知道「據點」這個詞的意義；
// 建立第二個據點的那一刻，移動時間那張表才自己冒出來。

type LocationDraft = {
  id?: string
  name: string
  address: string
  type: LocationType
}

export function LocationsCard({ locations }: { locations: Location[] }) {
  const router = useRouter()
  const [draft, setDraft] = useState<LocationDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const active = locations.filter((l) => l.is_active)
  const inactive = locations.filter((l) => !l.is_active)

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
      title="據點"
      sub={active.length ? `${active.length} 個` : '還沒有'}
      right={
        !draft && (
          <PrimaryButton
            onClick={() => {
              setError(null)
              setDraft({ name: '', address: '', type: 'onsite' })
            }}
          >
            ＋ 新增據點
          </PrimaryButton>
        )
      }
    >
      <div className="px-5 pt-1 pb-5">
        {active.length === 0 && !draft && (
          <p className="rounded-sm bg-sunk px-4 py-3.5 text-[12px] text-ink-3">
            只有一個固定店面的話，填一個就好；到府服務不需要建據點。
          </p>
        )}

        {active.length > 0 && (
          <ul className="flex flex-col">
            {active.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <b className="text-[13.5px] font-extrabold">{l.name}</b>
                    {l.type === 'mobile' && (
                      <span className="rounded-full bg-warn-bg px-2.5 py-0.5 text-[10px] font-extrabold text-warn">
                        到府
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-ink-4">{l.address || '未填地址'}</p>
                </div>
                <button
                  onClick={() => {
                    setError(null)
                    setDraft({
                      id: l.id,
                      name: l.name,
                      address: l.address ?? '',
                      type: l.type,
                    })
                  }}
                  className="text-[11.5px] font-extrabold text-ink-3 hover:text-primary"
                >
                  編輯
                </button>
                <button
                  onClick={() => run(() => setLocationActive(l.id, false))}
                  disabled={pending}
                  className="text-[11.5px] font-extrabold text-ink-4 hover:text-danger disabled:opacity-50"
                >
                  停用
                </button>
              </li>
            ))}
          </ul>
        )}

        {draft && (
          <div className="mt-3 rounded-sm bg-sunk px-4 pt-4 pb-3">
            <div className="grid gap-x-3.5 sm:grid-cols-2">
              <Field label="據點名稱">
                <TextBox
                  className="bg-card"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="五甲工作室"
                />
              </Field>
              <Field label="類型">
                <SelectBox
                  className="bg-card"
                  value={draft.type}
                  onChange={(e) =>
                    setDraft({ ...draft, type: e.target.value as LocationType })
                  }
                >
                  <option value="onsite">實體店面</option>
                  <option value="mobile">到府 / 無固定地點</option>
                </SelectBox>
              </Field>
            </div>
            <Field label="地址" optional hint="行事曆的導航連結會用這個地址">
              <TextBox
                className="bg-card"
                value={draft.address}
                onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                placeholder="高雄市鳳山區五甲二路 000 號"
              />
            </Field>
            <div className="flex gap-2">
              <PrimaryButton
                onClick={() =>
                  run(() =>
                    saveLocation({
                      id: draft.id,
                      name: draft.name,
                      address: draft.address,
                      type: draft.type,
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
              {inactive.map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => run(() => setLocationActive(l.id, true))}
                    disabled={pending}
                    className="rounded-full bg-sunk px-3.5 py-2 text-[11.5px] font-bold text-ink-3 transition hover:text-primary disabled:opacity-50"
                  >
                    {l.name} · 重新啟用
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10.5px] text-ink-4">
              停用只是不再顯示，排班與歷史資料都留著。
            </p>
          </div>
        )}

        <ErrorNote>{error}</ErrorNote>
      </div>
    </Card>
  )
}
