'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { AvailableSlot } from '@/lib/availability'
import { cn } from '@/lib/utils'
import { MapLink } from '@/components/MapLink'
import { loadSlots, submitBooking, type SlotsResult } from './actions'

// 客人的預約流程。草稿：docs/mockups/public-booking.html
//
// 三件事貫穿整支元件：
//   · 時段一律由伺服器算，前端不做任何「能不能約」的判斷
//   · 客人不註冊，手機號碼就是身分
//   · 免費方案沒有任何通知，所以完成頁要把話講清楚，並給 LINE

export type BookingService = {
  id: string
  name: string
  duration_mode: 'fixed' | 'hourly'
  duration_min: number | null
  min_hours: number | null
  max_hours: number | null
  price: number
  price_unit: 'per_session' | 'per_hour' | 'per_person'
  location_mode: 'fixed' | 'multi_site' | 'mobile'
  payment_mode: 'none' | 'deposit' | 'full'
}

export type DayOption = { date: string; weekday: number; open: boolean }

type LocationInfo = { name: string; address: string | null }

const WEEKDAY_LABEL = ['日', '一', '二', '三', '四', '五', '六']

export function BookingFlow({
  slug,
  linkRef,
  tenant,
  service,
  locations,
  days,
  initial,
}: {
  slug: string
  /**
   * 加好友那則訊息帶來的綁定記號。客人從那顆按鈕進來才有，
   * 送出時一起帶上去，系統就能把他的 LINE 接到這支手機號碼上。
   * 這裡只是原封不動地轉交，內容看不懂也不需要看懂。
   */
  linkRef: string | null
  tenant: {
    name: string
    timezone: string
    plan: 'free' | 'pro'
    lineFriendUrl: string | null
    contactPhone: string | null
  }
  service: BookingService
  locations: Record<string, LocationInfo>
  days: DayOption[]
  initial: SlotsResult & { date: string }
}) {
  const [step, setStep] = useState<'time' | 'form' | 'done'>('time')
  const [date, setDate] = useState(initial.date)
  const [slots, setSlots] = useState<AvailableSlot[]>(initial.slots)
  const [nextDate, setNextDate] = useState<string | null>(initial.nextDate)
  const [picked, setPicked] = useState<AvailableSlot | null>(null)
  const [hours, setHours] = useState(service.min_hours ?? 1)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [address, setAddress] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ code: string; status: 'confirmed' | 'pending' } | null>(
    null
  )
  const [pending, startTransition] = useTransition()

  const durationMin =
    service.duration_mode === 'hourly' ? Math.round(hours * 60) : service.duration_min ?? 0
  const price =
    service.price_unit === 'per_hour' ? service.price * (durationMin / 60) : service.price

  function refresh(nextDay: string, nextHours = hours) {
    setError(null)
    setPicked(null)
    setDate(nextDay)
    startTransition(async () => {
      const res = await loadSlots({
        slug,
        serviceId: service.id,
        date: nextDay,
        durationMin:
          service.duration_mode === 'hourly' ? Math.round(nextHours * 60) : null,
      })
      setSlots(res.slots)
      setNextDate(res.nextDate)
    })
  }

  function changeHours(next: number) {
    const min = service.min_hours ?? 0.5
    const max = service.max_hours ?? 8
    const clamped = Math.min(max, Math.max(min, next))
    setHours(clamped)
    refresh(date, clamped)
  }

  function send() {
    if (!picked) return
    setError(null)
    startTransition(async () => {
      const res = await submitBooking({
        slug,
        linkRef,
        serviceId: service.id,
        startAt: picked.start_at,
        bookableIds: picked.bookable_ids,
        locationId: picked.location_id,
        durationMin: service.duration_mode === 'hourly' ? durationMin : null,
        name,
        phone,
        note,
        serviceAddress: service.location_mode === 'mobile' ? address : undefined,
      })

      if (res.ok) {
        setResult({ code: res.code, status: res.status })
        setStep('done')
        return
      }

      setError(res.error)
      // 時段被搶走時把人送回時段列表並重新問一次，
      // 不要讓他對著一個已經不存在的時間乾瞪眼
      if (res.retry) {
        setStep('time')
        refresh(date)
      }
    })
  }

  const grouped = groupByLocation(slots)
  const showGroupTitle = grouped.length > 1

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-6 pb-28">
      <header className="mb-5 flex items-baseline gap-2.5">
        <Link href={`/p/${slug}`} className="text-[17px] font-extrabold text-ink-3">
          ‹
        </Link>
        <h1 className="text-[17px] font-extrabold tracking-tight">{tenant.name}</h1>
        {step !== 'done' && (
          <span className="num ml-auto text-[11.5px] font-extrabold text-ink-3">
            {step === 'time' ? '1' : '2'} / 2
          </span>
        )}
      </header>

      {step === 'done' && result ? (
        <Done
          result={result}
          tenant={tenant}
          service={service}
          picked={picked}
          price={price}
          durationMin={durationMin}
          locations={locations}
          slug={slug}
        />
      ) : step === 'form' ? (
        <>
          <Recap
            service={service}
            picked={picked}
            price={price}
            durationMin={durationMin}
            locations={locations}
            timezone={tenant.timezone}
          />

          <div className="mt-4 flex flex-col gap-3">
            <Labeled label="你的名字">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="王小姐"
                className="w-full rounded-sm bg-card px-3.5 py-3 text-[13.5px] shadow-soft outline-none focus:shadow-[0_0_0_3px_var(--accent)]"
              />
            </Labeled>

            <Labeled label="手機號碼" hint="店家會用這支號碼跟你聯絡">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="0912345678"
                className="num w-full rounded-sm bg-card px-3.5 py-3 text-[13.5px] font-extrabold shadow-soft outline-none focus:shadow-[0_0_0_3px_var(--accent)]"
              />
            </Labeled>

            {service.location_mode === 'mobile' && (
              <Labeled label="服務地址">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="高雄市三民區…"
                  className="w-full rounded-sm bg-card px-3.5 py-3 text-[13.5px] shadow-soft outline-none focus:shadow-[0_0_0_3px_var(--accent)]"
                />
              </Labeled>
            )}

            <Labeled label="想說的話" optional>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例：右肩比較緊、第一次來"
                className="h-20 w-full resize-none rounded-sm bg-card px-3.5 py-3 text-[13.5px] shadow-soft outline-none focus:shadow-[0_0_0_3px_var(--accent)]"
              />
            </Labeled>
          </div>

          {error && (
            <p className="mt-3 rounded-sm bg-danger-bg px-3.5 py-3 text-[12.5px] font-bold text-danger">
              {error}
            </p>
          )}

          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">
            送出即表示同意{tenant.name}的預約與取消規則。
          </p>

          <BottomBar>
            <button
              onClick={() => setStep('time')}
              disabled={pending}
              className="rounded-full bg-sunk px-5 py-3.5 text-[13px] font-extrabold text-ink-3"
            >
              上一步
            </button>
            <button
              onClick={send}
              disabled={pending || !name.trim() || !phone.trim()}
              className="flex-1 rounded-full bg-primary py-3.5 text-[14px] font-extrabold text-primary-foreground transition hover:brightness-95 disabled:opacity-45"
            >
              {pending ? '送出中…' : '送出預約'}
            </button>
          </BottomBar>
        </>
      ) : (
        <>
          <div className="mb-3 rounded-lg bg-card px-4 py-3 shadow-soft">
            <b className="text-[14px] font-extrabold">{service.name}</b>
            <p className="num mt-0.5 text-[11.5px] text-ink-3">
              {service.duration_mode === 'hourly'
                ? `${hours} 小時`
                : `${service.duration_min} 分鐘`}
              　·　NT$ {Math.round(price).toLocaleString('zh-TW')}
            </p>
          </div>

          {service.duration_mode === 'hourly' && (
            <div className="mb-4">
              <p className="mb-2 px-1 text-[11.5px] font-extrabold tracking-[0.1em] text-ink-3">
                要租幾小時
              </p>
              <div className="flex items-center gap-3 rounded-lg bg-card px-4 py-3 shadow-soft">
                <button
                  onClick={() => changeHours(hours - 0.5)}
                  disabled={pending}
                  className="size-9 shrink-0 rounded-full bg-sunk text-[17px] font-extrabold text-ink-2"
                >
                  −
                </button>
                <span className="num flex-1 text-center text-[17px] font-extrabold">
                  {hours} 小時
                </span>
                <button
                  onClick={() => changeHours(hours + 0.5)}
                  disabled={pending}
                  className="size-9 shrink-0 rounded-full bg-sunk text-[17px] font-extrabold text-ink-2"
                >
                  ＋
                </button>
              </div>
            </div>
          )}

          <div className="no-scrollbar -mx-1 mb-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {days.map((d) => {
              const on = d.date === date
              return (
                <button
                  key={d.date}
                  onClick={() => refresh(d.date)}
                  disabled={pending}
                  className={cn(
                    'w-13 shrink-0 rounded-sm py-2 text-center transition',
                    on
                      ? 'bg-primary text-primary-foreground shadow-card'
                      : d.open
                        ? 'bg-card shadow-soft'
                        : 'bg-card opacity-40 shadow-soft'
                  )}
                >
                  <span
                    className={cn(
                      'block text-[10.5px] font-extrabold',
                      on ? 'opacity-75' : 'text-ink-3'
                    )}
                  >
                    {WEEKDAY_LABEL[d.weekday]}
                  </span>
                  <span className="num block text-[16px] font-extrabold">
                    {Number(d.date.slice(8, 10))}
                  </span>
                </button>
              )
            })}
          </div>

          {pending ? (
            <p className="mt-6 text-center text-[12.5px] font-bold text-ink-3">
              正在算可以約的時段…
            </p>
          ) : slots.length === 0 ? (
            <div className="mt-3 rounded-lg bg-sunk px-5 py-8 text-center">
              <b className="block text-[13.5px] font-extrabold">這天約不到</b>
              {nextDate ? (
                <>
                  <p className="mt-1.5 text-[12px] text-ink-3">
                    最近可以約的是 {formatDay(nextDate)}
                  </p>
                  <button
                    onClick={() => refresh(nextDate)}
                    className="mt-3.5 rounded-full bg-primary px-5 py-2.5 text-[12.5px] font-extrabold text-primary-foreground"
                  >
                    看 {formatDay(nextDate)} 的時段
                  </button>
                </>
              ) : (
                <p className="mt-1.5 text-[12px] text-ink-3">
                  近期都約滿了，可以直接聯絡店家問問看。
                </p>
              )}
              <ContactLinks tenant={tenant} className="mt-4" />
            </div>
          ) : (
            grouped.map((group) => (
              <section key={group.locationId ?? 'none'} className="mt-3">
                {showGroupTitle && (
                  <div className="mb-2 flex items-baseline gap-2 px-1">
                    <b className="text-[11.5px] font-extrabold">
                      {locations[group.locationId ?? '']?.name ?? '不限地點'}
                    </b>
                    <MapLink
                      address={locations[group.locationId ?? '']?.address}
                      variant="text"
                    />
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {group.slots.map((s) => {
                    const on = picked?.start_at === s.start_at && picked?.location_id === s.location_id
                    return (
                      <button
                        key={`${s.start_at}-${s.location_id ?? ''}`}
                        onClick={() => setPicked(s)}
                        className={cn(
                          'num rounded-sm py-3 text-[13.5px] font-extrabold transition',
                          on
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card shadow-soft hover:shadow-card'
                        )}
                      >
                        {formatTime(s.start_at, tenant.timezone)}
                      </button>
                    )
                  })}
                </div>
              </section>
            ))
          )}

          {slots.length > 0 && (
            <p className="mt-5 text-[11.5px] leading-relaxed text-ink-3">
              只顯示確定可以預約的時段，已依店家當天的行程與移動時間計算。
            </p>
          )}

          {error && (
            <p className="mt-3 rounded-sm bg-danger-bg px-3.5 py-3 text-[12.5px] font-bold text-danger">
              {error}
            </p>
          )}

          <BottomBar>
            {picked ? (
              <>
                <div className="min-w-0 flex-1">
                  <b className="num block truncate text-[13px] font-extrabold">
                    {formatDay(date)} {formatTime(picked.start_at, tenant.timezone)}
                  </b>
                  {picked.location_id && (
                    <span className="block truncate text-[11px] font-bold text-ink-3">
                      {locations[picked.location_id]?.name}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setStep('form')}
                  className="rounded-full bg-primary px-7 py-3.5 text-[14px] font-extrabold text-primary-foreground transition hover:brightness-95"
                >
                  下一步
                </button>
              </>
            ) : (
              <div className="w-full rounded-full bg-sunk py-3.5 text-center text-[13px] font-extrabold text-ink-3">
                請先選一個時段
              </div>
            )}
          </BottomBar>
        </>
      )}
    </main>
  )
}

function Done({
  result,
  tenant,
  service,
  picked,
  price,
  durationMin,
  locations,
  slug,
}: {
  result: { code: string; status: 'confirmed' | 'pending' }
  tenant: {
    name: string
    timezone: string
    plan: 'free' | 'pro'
    lineFriendUrl: string | null
    contactPhone: string | null
  }
  service: BookingService
  picked: AvailableSlot | null
  price: number
  durationMin: number
  locations: Record<string, LocationInfo>
  slug: string
}) {
  const confirmed = result.status === 'confirmed'
  // 同一份地址在這頁要用兩次，查一次就好
  const placeAddress = picked?.location_id
    ? (locations[picked.location_id]?.address ?? null)
    : null

  return (
    <>
      <div className="pt-4 pb-1 text-center">
        <div
          className={cn(
            'mx-auto grid size-14 place-items-center rounded-full text-2xl font-extrabold',
            confirmed ? 'bg-accent text-accent-foreground' : 'bg-warn-bg text-warn'
          )}
        >
          {confirmed ? '✓' : '⏳'}
        </div>
        <h2 className="mt-3 text-[18px] font-extrabold tracking-tight">
          {confirmed ? '約好了' : '已送出，等店家確認'}
        </h2>
        {picked && (
          <p className="num mt-1 text-[12.5px] text-ink-3">
            {formatFullDay(picked.start_at, tenant.timezone)}{' '}
            {formatTime(picked.start_at, tenant.timezone)}
            {picked.location_id && `　${locations[picked.location_id]?.name}`}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-lg bg-card px-4 py-1 shadow-soft">
        <Row label="服務">
          {service.name}
          {service.duration_mode === 'hourly' ? ` ${durationMin / 60} 小時` : ` ${durationMin} 分`}
        </Row>
        {placeAddress && (
          <Row label="地址">
            <MapLink address={placeAddress} variant="text" className="font-bold" />
          </Row>
        )}
        <Row label="費用">NT$ {Math.round(price).toLocaleString('zh-TW')}</Row>
        <Row label="預約編號">{result.code}</Row>
      </div>

      {/* 約完最常做的下一件事就是找路。這頁是客人唯一的憑證，
          導航按鈕要跟 LINE 一樣是大顆的 */}
      <MapLink
        address={placeAddress}
        className="mt-3 w-full justify-center py-4 text-[13.5px]"
      />

      {tenant.lineFriendUrl ? (
        <a
          href={tenant.lineFriendUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center gap-3 rounded-lg bg-[#06C755] px-4 py-3.5 text-white"
        >
          <div className="min-w-0">
            <b className="block text-[13.5px] font-extrabold">加店家 LINE</b>
            <small className="text-[10.5px] opacity-90">
              {confirmed
                ? '有問題直接問，改期或取消也在這裡說'
                : '確認結果與提醒都會發到這裡'}
            </small>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-white/25 px-3.5 py-1.5 text-[11.5px] font-extrabold">
            加好友
          </span>
        </a>
      ) : (
        <ContactLinks tenant={tenant} className="mt-3" />
      )}

      {tenant.plan === 'free' ? (
        <p className="mt-3 rounded-sm bg-warn-bg px-4 py-3 text-[11.5px] leading-relaxed font-bold text-warn">
          這家店<b className="font-extrabold">不會自動發提醒訊息</b>
          ，請自己記得時間。需要改期或取消，請直接聯絡店家。
        </p>
      ) : (
        <p className="mt-3 rounded-sm bg-info-bg px-4 py-3 text-[11.5px] leading-relaxed font-bold text-info">
          {confirmed
            ? '前一天晚上與出發前各會收到一次 LINE 提醒。'
            : '店家確認後你會收到 LINE 通知。'}
        </p>
      )}

      <Link
        href={`/p/${slug}`}
        className="mt-5 py-2 text-center text-[12.5px] font-extrabold text-ink-3 hover:text-ink"
      >
        回到 {tenant.name}
      </Link>
    </>
  )
}

function Recap({
  service,
  picked,
  price,
  durationMin,
  locations,
  timezone,
}: {
  service: BookingService
  picked: AvailableSlot | null
  price: number
  durationMin: number
  locations: Record<string, LocationInfo>
  timezone: string
}) {
  if (!picked) return null
  return (
    <div className="rounded-lg bg-card px-4 py-1 shadow-soft">
      <Row label="服務">{service.name}</Row>
      <Row label="時間">
        {formatFullDay(picked.start_at, timezone)}{' '}
        {formatTime(picked.start_at, timezone)}–
        {formatTime(
          new Date(new Date(picked.start_at).getTime() + durationMin * 60000).toISOString(),
          timezone
        )}
      </Row>
      {picked.location_id && (
        <Row label="地點">
          <span className="block">{locations[picked.location_id]?.name}</span>
          {/* 客人最需要能點的就是這裡：看完地址下一步就是找路 */}
          <MapLink
            address={locations[picked.location_id]?.address}
            variant="text"
            className="mt-0.5 font-bold"
          />
        </Row>
      )}
      <Row label="費用">NT$ {Math.round(price).toLocaleString('zh-TW')}</Row>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-hairline py-2.5 last:border-b-0">
      <span className="shrink-0 text-[11.5px] font-bold text-ink-3">{label}</span>
      <b className="num text-right text-[13px] font-extrabold">{children}</b>
    </div>
  )
}

function Labeled({
  label,
  hint,
  optional,
  children,
}: {
  label: string
  hint?: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold text-ink-2">
        {label}
        {optional && <span className="font-bold text-ink-3">· 選填</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11.5px] text-ink-3">{hint}</p>}
    </div>
  )
}

function ContactLinks({
  tenant,
  className,
}: {
  tenant: { lineFriendUrl: string | null; contactPhone: string | null }
  className?: string
}) {
  if (!tenant.lineFriendUrl && !tenant.contactPhone) return null
  return (
    <div className={cn('flex flex-wrap justify-center gap-2', className)}>
      {tenant.lineFriendUrl && (
        <a
          href={tenant.lineFriendUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-[#06C755] px-5 py-2.5 text-[12px] font-extrabold text-white"
        >
          用 LINE 聯絡店家
        </a>
      )}
      {tenant.contactPhone && (
        <a
          href={`tel:${tenant.contactPhone}`}
          className="num rounded-full bg-card px-5 py-2.5 text-[12px] font-extrabold shadow-soft"
        >
          {tenant.contactPhone}
        </a>
      )}
    </div>
  )
}

/** 主要按鈕固定在底部：九成的客人是在 LINE 裡單手點開這頁的 */
function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-hairline bg-card/95 px-5 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center gap-2.5">{children}</div>
    </div>
  )
}

function groupByLocation(slots: AvailableSlot[]) {
  const groups: { locationId: string | null; slots: AvailableSlot[] }[] = []
  for (const slot of slots) {
    const group = groups.find((g) => g.locationId === slot.location_id)
    if (group) group.slots.push(slot)
    else groups.push({ locationId: slot.location_id, slots: [slot] })
  }
  for (const g of groups) g.slots.sort((a, b) => a.start_at.localeCompare(b.start_at))
  return groups
}

function formatTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

/** 8/3（一） */
function formatDay(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  return `${m}/${d}（${WEEKDAY_LABEL[weekday]}）`
}

function formatFullDay(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: timezone,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(iso))
}
