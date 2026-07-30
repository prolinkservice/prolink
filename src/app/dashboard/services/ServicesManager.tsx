'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  blankService,
  describeDeposit,
  describeDuration,
  formatPrice,
  type Bookable,
  type Location,
  type LocationMode,
  type ServiceDraft,
  type ServiceRow,
} from '@/lib/catalog'
import {
  Card,
  Chip,
  ErrorNote,
  Field,
  NumberBox,
  PrimaryButton,
  QuietButton,
  SelectBox,
  TextBox,
  ToggleRow,
} from '@/components/FormBits'
import { deleteService, saveService } from './actions'

// 草稿：docs/mockups/settings.html §01
// 上面三格（名稱、時長、價格）填完就能走，進階設定收在下面。
// 欄位跟著店的複雜度長出來，規則見 docs/mockups/progressive-settings.html

const LOCATION_MODES: { value: LocationMode; label: string }[] = [
  { value: 'fixed', label: '固定店面' },
  { value: 'multi_site', label: '多據點巡迴' },
  { value: 'mobile', label: '到府 / 無固定地點' },
]

type DepositChoice = 'none' | 'fixed' | 'percent' | 'full'

export function ServicesManager({
  services,
  bookables,
  locations,
  loadError,
}: {
  services: ServiceRow[]
  bookables: Bookable[]
  locations: Location[]
  loadError: string | null
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<ServiceDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function openNew() {
    setError(null)
    // 單人工作室通常只有一個標的，直接幫他勾好，他根本不用碰這一格
    const only = bookables.length === 1 ? [bookables[0].id] : []
    setDraft({ ...blankService(), bookableIds: only })
  }

  function openEdit(row: ServiceRow) {
    setError(null)
    setDraft({ ...row })
  }

  function submit(next: ServiceDraft) {
    setError(null)
    startTransition(async () => {
      const res = await saveService(next)
      if (!res.ok) return setError(res.error)
      setDraft(null)
      router.refresh()
    })
  }

  function remove(id: string) {
    setError(null)
    startTransition(async () => {
      const res = await deleteService(id)
      if (!res.ok) return setError(res.error)
      setDraft(null)
      router.refresh()
    })
  }

  return (
    <main className="px-6 pt-2 pb-10">
      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-[22px] font-extrabold tracking-tight">服務項目</h1>
        <p className="text-[12px] text-ink-3">客人在預約頁上看到、可以選的東西。</p>
        {!draft && (
          <PrimaryButton className="ml-auto" onClick={openNew}>
            ＋ 新增服務
          </PrimaryButton>
        )}
      </div>

      {loadError && (
        <p className="mb-4 rounded-sm bg-danger-bg px-4 py-3 text-[12.5px] font-bold text-danger">
          讀取服務項目失敗：{loadError}
        </p>
      )}

      {bookables.length === 0 && (
        <p className="mb-4 rounded-sm bg-warn-bg px-4 py-3 text-[12.5px] font-semibold text-warn">
          還沒有任何可預約的人或場地。先去
          <Link href="/dashboard/schedule" className="mx-1 font-extrabold underline">
            營業時間與據點
          </Link>
          建立，服務項目才知道要佔用什麼。
        </p>
      )}

      {draft ? (
        <ServiceEditor
          draft={draft}
          bookables={bookables}
          locations={locations}
          pending={pending}
          error={error}
          onChange={setDraft}
          onCancel={() => {
            setDraft(null)
            setError(null)
          }}
          onSave={submit}
          onDelete={remove}
        />
      ) : (
        <>
          <ErrorNote>{error}</ErrorNote>
          {services.length === 0 ? (
            <div className="rounded-lg bg-card px-6 py-14 text-center shadow-card">
              <div className="mx-auto mb-4 size-14 rounded-lg bg-accent" />
              <b className="block text-[15px] font-extrabold">還沒有服務項目</b>
              <p className="mx-auto mt-1.5 max-w-[34ch] text-[13px] text-ink-3">
                先建一項最常做的，名稱、時長、價格填完就能開始接單。
              </p>
              <PrimaryButton className="mt-5" onClick={openNew}>
                ＋ 新增服務
              </PrimaryButton>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {services.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => openEdit(s)}
                    className="flex w-full items-center gap-3 rounded-lg bg-card px-5 py-4 text-left shadow-soft transition hover:shadow-card"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-[14.5px] font-extrabold tracking-tight">{s.name}</b>
                        {!s.is_active && (
                          <span className="rounded-full bg-sunk px-2.5 py-0.5 text-[10px] font-extrabold text-ink-3">
                            未開放線上預約
                          </span>
                        )}
                        {s.location_mode === 'mobile' && (
                          <span className="rounded-full bg-warn-bg px-2.5 py-0.5 text-[10px] font-extrabold text-warn">
                            到府
                          </span>
                        )}
                        {s.capacity > 1 && (
                          <span className="rounded-full bg-info-bg px-2.5 py-0.5 text-[10px] font-extrabold text-info">
                            團體課 {s.capacity} 人
                          </span>
                        )}
                      </div>
                      <p className="num mt-1 text-[11.5px] text-ink-3">
                        {[
                          describeDuration(s),
                          formatPrice(s),
                          describeDeposit(s),
                          bookableNames(s.bookableIds, bookables),
                        ]
                          .filter(Boolean)
                          .join('　·　')}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11.5px] font-extrabold text-ink-4">編輯</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  )
}

function bookableNames(ids: string[], bookables: Bookable[]): string {
  const names = ids
    .map((id) => bookables.find((b) => b.id === id)?.name)
    .filter((n): n is string => Boolean(n))
  return names.length ? names.join(' + ') : ''
}

function ServiceEditor({
  draft,
  bookables,
  locations,
  pending,
  error,
  onChange,
  onCancel,
  onSave,
  onDelete,
}: {
  draft: ServiceDraft
  bookables: Bookable[]
  locations: Location[]
  pending: boolean
  error: string | null
  onChange: (next: ServiceDraft) => void
  onCancel: () => void
  onSave: (draft: ServiceDraft) => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [askMobile, setAskMobile] = useState(false)
  const [areaInput, setAreaInput] = useState('')

  function patch(part: Partial<ServiceDraft>) {
    onChange({ ...draft, ...part })
  }

  const multiSite = locations.length >= 2
  // 只有一個據點的老師從頭到尾不該看到「據點」兩個字，
  // 但到府服務要有路可走，所以留一行字讓他自己叫出來
  const showLocationMode = multiSite || draft.location_mode !== 'fixed' || askMobile

  const depositChoice: DepositChoice =
    draft.payment_mode === 'full'
      ? 'full'
      : draft.payment_mode === 'deposit'
        ? draft.deposit_type === 'percent'
          ? 'percent'
          : 'fixed'
        : 'none'

  function setDeposit(choice: DepositChoice) {
    if (choice === 'none') return patch({ payment_mode: 'none', deposit_type: 'none', deposit_value: null })
    if (choice === 'full') return patch({ payment_mode: 'full', deposit_type: 'none', deposit_value: null })
    patch({
      payment_mode: 'deposit',
      deposit_type: choice,
      deposit_value: draft.deposit_value ?? (choice === 'percent' ? 30 : 300),
    })
  }

  const bufferOn = draft.buffer_before_min > 0 || draft.buffer_after_min > 0
  const area = draft.service_area ?? []

  function addArea() {
    const value = areaInput.trim()
    if (!value || area.includes(value)) return setAreaInput('')
    patch({ service_area: [...area, value] })
    setAreaInput('')
  }

  return (
    <Card
      title={draft.id ? '編輯服務項目' : '新增服務項目'}
      sub={draft.id ? draft.name : undefined}
      right={
        <>
          <QuietButton onClick={onCancel} disabled={pending}>
            取消
          </QuietButton>
          <PrimaryButton onClick={() => onSave(draft)} disabled={pending}>
            {pending ? '儲存中…' : '儲存'}
          </PrimaryButton>
        </>
      }
    >
      <div className="px-5 pt-2 pb-5">
        <div className="grid gap-x-3.5 sm:grid-cols-2">
          <Field label="服務名稱">
            <TextBox
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="深層運動按摩"
            />
          </Field>
          <Field label="分類" optional>
            <TextBox
              value={draft.category ?? ''}
              onChange={(e) => patch({ category: e.target.value })}
              placeholder="按摩"
            />
          </Field>
        </div>

        <div className="grid gap-x-3.5 sm:grid-cols-3">
          <Field label="時長模式">
            <SelectBox
              value={draft.duration_mode}
              onChange={(e) =>
                patch(
                  e.target.value === 'hourly'
                    ? { duration_mode: 'hourly', min_hours: draft.min_hours ?? 1, max_hours: draft.max_hours ?? 3 }
                    : { duration_mode: 'fixed', duration_min: draft.duration_min ?? 60 }
                )
              }
            >
              <option value="fixed">固定時長</option>
              <option value="hourly">按小時計（場地租借）</option>
            </SelectBox>
          </Field>

          {draft.duration_mode === 'fixed' ? (
            <Field label="時長">
              <NumberBox
                value={draft.duration_min}
                onValueChange={(v) => patch({ duration_min: v })}
                min={15}
                step={15}
                suffix="分鐘"
              />
            </Field>
          ) : (
            <Field label="可租時數">
              <div className="flex items-center gap-2">
                <NumberBox
                  value={draft.min_hours}
                  onValueChange={(v) => patch({ min_hours: v })}
                  min={0.5}
                  step={0.5}
                  suffix="起"
                />
                <span className="text-[11px] font-bold text-ink-4">至</span>
                <NumberBox
                  value={draft.max_hours}
                  onValueChange={(v) => patch({ max_hours: v })}
                  min={0.5}
                  step={0.5}
                  suffix="小時"
                />
              </div>
            </Field>
          )}

          <Field
            label="價格"
            hint={
              draft.duration_mode === 'hourly'
                ? '每小時的價格'
                : draft.capacity > 1
                  ? '每個人的價格'
                  : '參考價，實收金額結帳時再登記'
            }
          >
            <NumberBox
              value={draft.price}
              onValueChange={(v) => patch({ price: v })}
              min={0}
              step={100}
              prefix="NT$"
            />
          </Field>
        </div>

        {/* 佔用什麼資源是整頁的關鍵：系統靠這個判斷時段能不能約 */}
        <div className="mb-3.5 rounded-sm bg-sunk px-4 py-3.5">
          <b className="block text-[12px] font-extrabold text-ink-2">
            做這項服務時會佔用什麼？
          </b>
          <p className="mt-0.5 mb-3 text-[11px] text-ink-4">
            系統靠這個防止同一個時段被重複約走。單人工作室通常只要勾自己。
          </p>
          <div className="flex flex-wrap gap-2">
            {bookables.map((b) => {
              const on = draft.bookableIds.includes(b.id)
              return (
                <Chip
                  key={b.id}
                  on={on}
                  onClick={() =>
                    patch({
                      bookableIds: on
                        ? draft.bookableIds.filter((id) => id !== b.id)
                        : [...draft.bookableIds, b.id],
                    })
                  }
                >
                  {b.name}
                </Chip>
              )
            })}
            <Link
              href="/dashboard/schedule"
              className="rounded-full bg-card px-4 py-2.5 text-[12px] font-extrabold text-ink-4 shadow-soft transition hover:text-primary"
            >
              ＋ 新增資源
            </Link>
          </div>
        </div>

        <div className="grid gap-x-3.5 sm:grid-cols-2">
          {showLocationMode && (
            <Field
              label="地點模式"
              isNew={multiSite}
              hint={
                draft.location_mode === 'multi_site'
                  ? '可預約時段會依你當天在哪個據點自動篩選'
                  : undefined
              }
            >
              <SelectBox
                value={draft.location_mode}
                onChange={(e) =>
                  patch({
                    location_mode: e.target.value as LocationMode,
                    location_id: e.target.value === 'fixed' ? draft.location_id : null,
                  })
                }
              >
                {LOCATION_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </SelectBox>
            </Field>
          )}

          {showLocationMode && draft.location_mode === 'fixed' && multiSite && (
            <Field label="固定在哪一間" hint="客人不用選地點，系統直接帶">
              <SelectBox
                value={draft.location_id ?? ''}
                onChange={(e) => patch({ location_id: e.target.value || null })}
              >
                <option value="">不限定</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </SelectBox>
            </Field>
          )}

          <Field label="定金" hint="收不到定金的放鳥，成本全是老師在吃">
            <SelectBox
              value={depositChoice}
              onChange={(e) => setDeposit(e.target.value as DepositChoice)}
            >
              <option value="none">不收</option>
              <option value="fixed">固定金額</option>
              <option value="percent">定價百分比</option>
              <option value="full">全額預收</option>
            </SelectBox>
          </Field>

          {draft.payment_mode === 'deposit' && (
            <Field label={draft.deposit_type === 'percent' ? '定金百分比' : '定金金額'}>
              <NumberBox
                value={draft.deposit_value}
                onValueChange={(v) => patch({ deposit_value: v })}
                min={0}
                step={draft.deposit_type === 'percent' ? 5 : 100}
                prefix={draft.deposit_type === 'percent' ? undefined : 'NT$'}
                suffix={draft.deposit_type === 'percent' ? '%' : undefined}
              />
            </Field>
          )}
        </div>

        {!showLocationMode && (
          <button
            type="button"
            onClick={() => {
              setAskMobile(true)
              patch({ location_mode: 'mobile' })
            }}
            className="mb-3 text-[11.5px] font-extrabold text-ink-4 hover:text-primary"
          >
            這項是到府服務？→
          </button>
        )}

        {draft.location_mode === 'mobile' && (
          <Field
            label="服務區域"
            isNew
            hint="超出區域的客人在預約頁上會直接看不到這項服務。留空表示不限。"
          >
            <div className="flex flex-wrap items-center gap-2">
              {area.map((a) => (
                <span
                  key={a}
                  className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-2 text-[11.5px] font-extrabold text-accent-foreground"
                >
                  {a}
                  <button
                    type="button"
                    aria-label={`移除 ${a}`}
                    onClick={() => patch({ service_area: area.filter((x) => x !== a) })}
                    className="text-[13px] leading-none opacity-60 hover:opacity-100"
                  >
                    ×
                  </button>
                </span>
              ))}
              <TextBox
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addArea()
                  }
                }}
                onBlur={addArea}
                placeholder="三民區"
                className="w-28"
              />
            </div>
          </Field>
        )}

        <div className="mt-1 border-t border-hairline pt-1">
          <ToggleRow
            title="服務前後需要緩衝時間"
            desc="準備器材、整理環境、換床單"
            on={bufferOn}
            onToggle={(next) =>
              patch(
                next
                  ? { buffer_before_min: 0, buffer_after_min: 10 }
                  : { buffer_before_min: 0, buffer_after_min: 0 }
              )
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] font-extrabold text-ink-3">服務前</span>
              <NumberBox
                value={draft.buffer_before_min}
                onValueChange={(v) => patch({ buffer_before_min: v })}
                min={0}
                step={5}
                suffix="分"
                className="w-28"
              />
              <span className="ml-2 text-[11.5px] font-extrabold text-ink-3">服務後</span>
              <NumberBox
                value={draft.buffer_after_min}
                onValueChange={(v) => patch({ buffer_after_min: v })}
                min={0}
                step={5}
                suffix="分"
                className="w-28"
              />
              <p className="w-full text-[10.5px] text-ink-4">
                這段時間會一起被鎖住，客人約不到。關掉開關就等於前後都 0 分。
              </p>
            </div>
          </ToggleRow>

          <ToggleRow
            title="這是團體課程"
            desc="同一個時段可以收多位客人"
            on={draft.capacity > 1}
            onToggle={(next) =>
              patch(
                next
                  ? { capacity: 8, min_headcount: 2 }
                  : { capacity: 1, min_headcount: null }
              )
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] font-extrabold text-ink-3">最多</span>
              <NumberBox
                value={draft.capacity}
                onValueChange={(v) => patch({ capacity: Math.max(2, v) })}
                min={2}
                step={1}
                suffix="人"
                className="w-28"
              />
              <span className="ml-2 text-[11.5px] font-extrabold text-ink-3">最低成團</span>
              <NumberBox
                value={draft.min_headcount}
                onValueChange={(v) => patch({ min_headcount: v })}
                min={1}
                step={1}
                suffix="人"
                className="w-28"
              />
            </div>
          </ToggleRow>

          <ToggleRow
            title="開放線上預約"
            desc="關掉之後客人看不到，只能由你手動建立"
            on={draft.is_active}
            onToggle={(next) => patch({ is_active: next })}
          />
        </div>

        <ErrorNote>{error}</ErrorNote>

        {draft.id && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
            {confirmDelete ? (
              <>
                <span className="text-[12px] font-bold text-danger">
                  確定刪除「{draft.name}」？
                </span>
                <QuietButton danger onClick={() => onDelete(draft.id!)} disabled={pending}>
                  確定刪除
                </QuietButton>
                <QuietButton onClick={() => setConfirmDelete(false)} disabled={pending}>
                  不要
                </QuietButton>
              </>
            ) : (
              <QuietButton danger onClick={() => setConfirmDelete(true)} disabled={pending}>
                刪除這項服務
              </QuietButton>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
