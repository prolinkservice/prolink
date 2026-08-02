'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AvailableSlot } from '@/lib/availability'
import { formatTime, todayIn, zonedTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import {
  ErrorNote,
  Field,
  NumberBox,
  PrimaryButton,
  QuietButton,
  SelectBox,
  TextBox,
} from '@/components/FormBits'
import {
  createManualBooking,
  manualSlots,
  searchCustomers,
  type CustomerHit,
} from './actions'

// 手動建立預約。草稿：docs/mockups/dashboard.html §03
//
// 這頁的態度是「系統提醒但不擋路」：引擎算不出來的時段會跳警告說明原因，
// 但老師按第二次還是建得起來——他可能就住在附近。
// 唯一硬擋的是同一個人或同一間包廂時間重疊，那是物理上不可能的事。

export type ServiceOption = {
  id: string
  name: string
  duration_mode: 'fixed' | 'hourly'
  duration_min: number | null
  min_hours: number | null
  price: number
  location_id: string | null
  /** 到府的服務沒有據點，地址要現場問客人 */
  location_mode: 'fixed' | 'multi_site' | 'mobile'
}

export type LocationOption = { id: string; name: string }

export function NewBookingSheet({
  services,
  locations,
  timezone,
  initialDate,
  initialTime,
  onClose,
}: {
  services: ServiceOption[]
  locations: LocationOption[]
  timezone: string
  initialDate?: string
  initialTime?: string
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<CustomerHit[]>([])
  const [customer, setCustomer] = useState<CustomerHit | null>(null)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')

  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const service = services.find((s) => s.id === serviceId)
  const [durationMin, setDurationMin] = useState(defaultDuration(services[0]))
  const [locationId, setLocationId] = useState<string | null>(
    services[0]?.location_id ?? locations[0]?.id ?? null
  )

  const [date, setDate] = useState(initialDate ?? todayIn(timezone))
  const [time, setTime] = useState(initialTime ?? '19:00')
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null)

  const [serviceAddress, setServiceAddress] = useState('')
  const [note, setNote] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmOdd, setConfirmOdd] = useState(false)

  const slotTimes = (slots ?? []).map((s) => formatTime(s.start_at, timezone))
  // 引擎沒列出這個時間，通常是被約走、來不及移動、或不在營業時間內
  const offGrid = slots !== null && slots.length >= 0 && !slotTimes.includes(time)

  function find(value: string) {
    setQuery(value)
    setConfirmOdd(false)
    if (value.trim().length < 2) return setHits([])
    startTransition(async () => setHits(await searchCustomers(value)))
  }

  function pickService(id: string) {
    const next = services.find((s) => s.id === id)
    setServiceId(id)
    setDurationMin(defaultDuration(next))
    if (next?.location_id) setLocationId(next.location_id)
    setSlots(null)
    setConfirmOdd(false)
  }

  function loadSlots(nextDate = date) {
    if (!serviceId) return
    setDate(nextDate)
    setConfirmOdd(false)
    startTransition(async () => {
      setSlots(await manualSlots({ serviceId, date: nextDate, durationMin }))
    })
  }

  function submit() {
    setError(null)
    if (!service) return setError('請選服務項目')
    if (!customer && !newName.trim()) return setError('請選客人或填新客人的名字')

    // 第一次按到「引擎算不出來」的時段時先跳警告，第二次才真的建立
    if (offGrid && !confirmOdd) {
      setConfirmOdd(true)
      return
    }

    const startAt = zonedTime(date, time, timezone).toISOString()
    startTransition(async () => {
      const res = await createManualBooking({
        serviceId,
        startAt,
        customerId: customer?.id ?? null,
        name: customer ? undefined : newName,
        phone: customer ? undefined : newPhone,
        locationId,
        durationMin,
        serviceAddress: service.location_mode === 'mobile' ? serviceAddress : undefined,
        note,
        internalNote,
      })
      if (!res.ok) {
        setConfirmOdd(false)
        return setError(res.error)
      }
      onClose()
      router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-card shadow-float sm:rounded-xl">
        <header className="sticky top-0 z-10 flex items-center gap-3 bg-card px-5 pt-5 pb-2">
          <h2 className="text-[16px] font-extrabold tracking-tight">新增預約</h2>
          <span className="text-[11.5px] font-bold text-ink-3">手動建立</span>
          <button
            onClick={onClose}
            aria-label="關閉"
            className="ml-auto grid size-8 place-items-center rounded-full bg-sunk text-[15px] font-extrabold text-ink-3"
          >
            ✕
          </button>
        </header>

        <div className="px-5 pb-5">
          {/* ── 客人 ── */}
          {customer ? (
            <div className="mb-3.5 rounded-sm bg-sunk px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-extrabold text-accent-foreground">
                  {customer.name.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <b className="block text-[13.5px] font-extrabold">{customer.name}</b>
                  <span className="num text-[11.5px] text-ink-3">{customer.phone}</span>
                </div>
                <button
                  onClick={() => setCustomer(null)}
                  className="ml-auto text-[11.5px] font-extrabold text-ink-3 hover:text-primary"
                >
                  更換
                </button>
              </div>
              {/* 信賴紀錄：老師心裡有數再決定收不收定金 */}
              <div className="num mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold">
                <span className="text-ink-3">到店 {customer.visit_count} 次</span>
                {customer.no_show_points > 0 && (
                  <span className="text-danger">放鳥點數 {customer.no_show_points}</span>
                )}
                {customer.is_blocked && (
                  <span className="text-danger">已封鎖（線上約不到，你仍可手動建立）</span>
                )}
              </div>
            </div>
          ) : (
            <>
              <Field label="找客人" hint="打手機號碼或名字，找不到就直接填下面新增">
                <TextBox
                  value={query}
                  onChange={(e) => find(e.target.value)}
                  placeholder="0912 或 陳"
                />
              </Field>
              {hits.length > 0 && (
                <ul className="mb-3.5 flex flex-col gap-1.5">
                  {hits.map((h) => (
                    <li key={h.id}>
                      <button
                        onClick={() => {
                          setCustomer(h)
                          setHits([])
                          setQuery('')
                        }}
                        className="flex w-full items-center gap-3 rounded-sm bg-sunk px-3.5 py-2.5 text-left"
                      >
                        <b className="text-[13px] font-extrabold">{h.name}</b>
                        <span className="num text-[11.5px] text-ink-3">{h.phone}</span>
                        <span className="num ml-auto text-[11.5px] font-bold text-ink-3">
                          到店 {h.visit_count}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid gap-x-3.5 sm:grid-cols-2">
                <Field label="新客人姓名">
                  <TextBox
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="陳小姐"
                  />
                </Field>
                <Field label="手機號碼" optional>
                  <TextBox
                    className="num"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="0912345678"
                    inputMode="tel"
                  />
                </Field>
              </div>
            </>
          )}

          {/* ── 服務與時間 ── */}
          <div className="grid gap-x-3.5 sm:grid-cols-2">
            <Field label="服務項目">
              <SelectBox value={serviceId} onChange={(e) => pickService(e.target.value)}>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </SelectBox>
            </Field>
            <Field label="時長" hint="手動建單可以改，不受服務設定限制">
              <NumberBox
                value={durationMin}
                onValueChange={setDurationMin}
                min={15}
                step={15}
                suffix="分鐘"
              />
            </Field>
          </div>

          <div className="grid gap-x-3.5 sm:grid-cols-2">
            <Field label="日期">
              <TextBox
                type="date"
                className="num"
                value={date}
                onChange={(e) => loadSlots(e.target.value)}
              />
            </Field>
            <Field label="時間" hint="老師可以填任意時間，不必卡在整點半點">
              <TextBox
                type="time"
                step={900}
                className="num"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value)
                  setConfirmOdd(false)
                }}
              />
            </Field>
          </div>

          {locations.length > 0 && (
            <Field label="地點">
              <SelectBox
                value={locationId ?? ''}
                onChange={(e) => setLocationId(e.target.value || null)}
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

          {service?.location_mode === 'mobile' && (
            <Field label="到府地址" hint="接電話當下就問清楚，出發前才不用再打一次">
              <TextBox
                value={serviceAddress}
                onChange={(e) => setServiceAddress(e.target.value)}
                placeholder="高雄市三民區建工路100號12樓"
              />
            </Field>
          )}

          <div className="mb-3.5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[11px] font-extrabold text-ink-2">可約時段</span>
              <button
                onClick={() => loadSlots()}
                disabled={pending || !serviceId}
                className="text-[11px] font-extrabold text-primary hover:underline disabled:opacity-40"
              >
                {slots === null ? '查這天的空檔' : '重新查'}
              </button>
            </div>
            {pending && slots === null ? (
              <p className="text-[11.5px] font-bold text-ink-4">查詢中…</p>
            ) : slots === null ? (
              <p className="text-[11.5px] text-ink-3">
                按上面那顆會列出引擎算出來的空檔，點一下就帶入時間。
              </p>
            ) : slots.length === 0 ? (
              <p className="text-[11.5px] font-bold text-warn">
                這天沒有算得出來的空檔，你仍然可以自己填時間。
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {slots.map((s) => {
                  const label = formatTime(s.start_at, timezone)
                  return (
                    <button
                      key={`${s.start_at}-${s.location_id ?? ''}`}
                      onClick={() => {
                        setTime(label)
                        setConfirmOdd(false)
                        if (s.location_id) setLocationId(s.location_id)
                      }}
                      className={cn(
                        'num rounded-full px-3.5 py-2 text-[12px] font-extrabold transition',
                        label === time
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-sunk text-ink-2 hover:text-primary'
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="grid gap-x-3.5 sm:grid-cols-2">
            <Field label="備註" optional hint="客人看得到">
              <TextBox value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <Field label="內部備註" optional hint="只有你看得到">
              <TextBox
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
              />
            </Field>
          </div>

          {confirmOdd && (
            <p className="mb-3 rounded-sm bg-warn-bg px-4 py-3 text-[12px] leading-relaxed font-bold text-warn">
              {date} {time} 不在系統算出來的可約時段裡——可能是已經有預約、來不及從上一個地點趕過來，
              或不在營業時間內。<b className="font-extrabold">再按一次「建立預約」就會照你說的建。</b>
            </p>
          )}

          <ErrorNote>{error}</ErrorNote>

          <div className="mt-4 flex gap-2">
            <PrimaryButton className="flex-1 py-3.5" onClick={submit} disabled={pending}>
              {pending ? '建立中…' : confirmOdd ? '仍然建立' : '建立預約'}
            </PrimaryButton>
            <QuietButton onClick={onClose} disabled={pending}>
              取消
            </QuietButton>
          </div>
        </div>
      </div>
    </div>
  )
}

function defaultDuration(service?: ServiceOption): number {
  if (!service) return 60
  if (service.duration_mode === 'hourly') return Math.round((service.min_hours ?? 1) * 60)
  return service.duration_min ?? 60
}
