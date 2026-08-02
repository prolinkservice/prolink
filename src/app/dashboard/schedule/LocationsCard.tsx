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
import { MapLink } from '@/components/MapLink'
import { cn } from '@/lib/utils'
import { removeLocationPhoto, saveLocation, saveLocationPhoto, setLocationActive } from './actions'

/**
 * 手機直出的照片動輒 4MB，伺服器動作的請求塞不下，
 * 而且客人的預約頁也不該為了一張橫幅等三秒。
 * 縮到寬 1200 之後通常落在 200KB 上下，橫幅這個尺寸綽綽有餘。
 */
const MAX_WIDTH = 1200

async function compress(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_WIDTH / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  // 0.82 是肉眼看不太出差別、檔案卻小很多的那個位置
  return canvas.toDataURL('image/jpeg', 0.82).split(',')[1] ?? ''
}

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
  const [uploading, setUploading] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function upload(locationId: string, file: File | undefined) {
    if (!file) return
    setError(null)
    setUploading(locationId)
    try {
      const base64 = await compress(file)
      const res = await saveLocationPhoto({ locationId, base64 })
      if (!res.ok) setError(res.error)
      else router.refresh()
    } catch (uploadError) {
      console.error('[location-photo] 壓縮或上傳失敗', uploadError)
      setError('這張照片讀不到，換一張試試')
    } finally {
      setUploading(null)
    }
  }

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
          <p className="rounded-sm bg-sunk px-4 py-3.5 text-[12.5px] text-ink-3">
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
                {/* 照片：到府沒有實體空間可拍，不問 */}
                {l.type !== 'mobile' && (
                  <label
                    className={cn(
                      'relative grid h-14 w-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-sm bg-sunk text-[10px] font-extrabold text-ink-4',
                      uploading === l.id && 'opacity-50'
                    )}
                  >
                    {l.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={l.photo_url}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <span>＋ 照片</span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={uploading !== null || pending}
                      onChange={(e) => {
                        void upload(l.id, e.target.files?.[0])
                        e.target.value = ''
                      }}
                    />
                  </label>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <b className="text-[13.5px] font-extrabold">{l.name}</b>
                    {l.type === 'mobile' && (
                      <span className="rounded-full bg-warn-bg px-2.5 py-0.5 text-[10px] font-extrabold text-warn">
                        到府
                      </span>
                    )}
                  </div>
                  {l.address ? (
                    <MapLink address={l.address} variant="text" />
                  ) : (
                    <p className="text-[11.5px] text-ink-3">未填地址</p>
                  )}
                  {l.type !== 'mobile' && (
                    <p className="text-[11px] leading-relaxed text-ink-3">
                      {uploading === l.id ? (
                        '上傳中…'
                      ) : l.photo_url ? (
                        <>
                          客人選地點時會看到這張
                          <button
                            onClick={() => run(() => removeLocationPhoto(l.id))}
                            disabled={pending}
                            className="ml-2 font-extrabold text-ink-3 hover:text-danger"
                          >
                            移除照片
                          </button>
                        </>
                      ) : (
                        '點左邊加一張空間照片，拍空間就好，不用拍到人'
                      )}
                    </p>
                  )}
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
                  className="text-[12px] font-extrabold text-ink-3 hover:text-danger disabled:opacity-50"
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
            <p className="mt-2 text-[11.5px] text-ink-3">
              停用只是不再顯示，排班與歷史資料都留著。
            </p>
          </div>
        )}

        <ErrorNote>{error}</ErrorNote>
      </div>
    </Card>
  )
}
