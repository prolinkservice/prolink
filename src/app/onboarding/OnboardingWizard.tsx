'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { checkSlug, createTenant } from './actions'
import { normalizeSlug } from '@/lib/tenant-slug'

// 註冊精靈。唯一目標是讓職人拿到一條可以傳給客人的預約連結，
// 跟這件事無關的設定全部往後挪。草稿：docs/mockups/landing-and-onboarding.html

const WEEKDAYS = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 0, label: '日' },
]

const TOTAL_STEPS = 3

export function OnboardingWizard({ siteUrl }: { siteUrl: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [step, setStep] = useState(1)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugState, setSlugState] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle')
  const [slugMsg, setSlugMsg] = useState('')

  const [serviceName, setServiceName] = useState('')
  const [durationMin, setDurationMin] = useState(60)
  const [price, setPrice] = useState(1200)

  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6])
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('21:00')

  const bookingUrl = `${siteUrl.replace(/\/$/, '')}/p/${slug}`

  function handleSlugChange(value: string) {
    setSlug(normalizeSlug(value))
    setSlugState('idle')
    setSlugMsg('')
  }

  function verifySlug() {
    if (!slug) return
    setSlugState('checking')
    startTransition(async () => {
      const res = await checkSlug(slug)
      setSlugState(res.ok ? 'ok' : 'bad')
      setSlugMsg(res.ok ? '這個網址可以使用' : res.reason)
    })
  }

  function next() {
    setError(null)
    if (step === 1) {
      if (!name.trim()) return setError('請填品牌名稱')
      if (!slug) return setError('請填你的專屬網址')
      if (slugState !== 'ok') return setError('請先確認網址可以使用')
    }
    if (step === 2 && !serviceName.trim()) {
      return setError('請填一項服務名稱')
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await createTenant({
        name,
        slug,
        displayName: name,
        serviceName,
        durationMin,
        price,
        weekdays,
        startTime,
        endTime,
      })
      if (res.ok) setDone(true)
      else setError(res.error)
    })
  }

  if (done) {
    return (
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-xl bg-card p-7 text-center shadow-card">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-accent text-2xl font-extrabold text-accent-foreground">
            ✓
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">可以開始接單了</h1>
          <p className="mt-2 text-[13px] text-ink-3">
            把這條連結傳給客人，他們就能自己約。
          </p>

          <div className="mt-5 rounded-sm bg-accent px-4 py-3.5">
            <p className="text-[10px] font-extrabold tracking-[0.08em] text-accent-foreground opacity-80">
              你的預約連結
            </p>
            <p className="mt-1 text-[13px] font-extrabold break-all text-accent-foreground">
              {bookingUrl}
            </p>
          </div>

          <button
            onClick={() => navigator.clipboard?.writeText(bookingUrl)}
            className="mt-4 w-full rounded-full bg-primary py-3.5 text-[13.5px] font-extrabold text-primary-foreground transition hover:brightness-95"
          >
            複製連結
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-2 w-full py-2.5 text-[12.5px] font-extrabold text-ink-4 hover:text-ink"
          >
            進入後台
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-xl bg-card shadow-card">
        <div className="flex items-center gap-2 px-5 pt-5 pb-2">
          <span className="grid size-5.5 place-items-center rounded-[7px] bg-primary text-[10px] font-extrabold text-primary-foreground">
            P
          </span>
          <span className="text-xs font-extrabold tracking-tight">職人連結</span>
          <span className="num ml-auto text-[10px] font-extrabold text-ink-4">
            {step} / {TOTAL_STEPS}
          </span>
        </div>
        <div className="mx-5 mb-4 h-[3px] overflow-hidden rounded-full bg-sunk">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        <div className="px-5 pb-2">
          {step === 1 && (
            <>
              <h1 className="text-[19px] leading-tight font-extrabold tracking-tight">
                你的品牌叫什麼
              </h1>
              <p className="mt-1 mb-4 text-[11.5px] text-ink-3">
                客人打開預約頁時看到的名字。
              </p>

              <Field label="品牌或工作室名稱">
                <input
                  className="w-full rounded-sm bg-sunk px-3.5 py-3 text-[13px] outline-none focus:bg-card focus:shadow-[0_0_0_3px_var(--accent)]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="五甲運動按摩"
                />
              </Field>

              <Field label="你的專屬網址">
                <div className="flex items-center rounded-sm bg-sunk pl-3.5">
                  <span className="text-[11.5px] font-bold whitespace-nowrap text-ink-4">
                    /p/
                  </span>
                  <input
                    className="min-w-0 flex-1 bg-transparent px-1 py-3 text-[13px] font-extrabold text-primary outline-none"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    onBlur={verifySlug}
                    placeholder="wangteacher"
                  />
                  <button
                    type="button"
                    onClick={verifySlug}
                    disabled={!slug || pending}
                    className="m-1 rounded-full bg-card px-3 py-2 text-[11px] font-extrabold text-ink-3 disabled:opacity-40"
                  >
                    {slugState === 'checking' ? '檢查中' : '檢查'}
                  </button>
                </div>
                {slugState === 'ok' && (
                  <p className="mt-1.5 text-[10.5px] font-extrabold text-ok">✓ {slugMsg}</p>
                )}
                {slugState === 'bad' && (
                  <p className="mt-1.5 text-[10.5px] font-extrabold text-danger">{slugMsg}</p>
                )}
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-4">
                  之後可以改，舊網址會自動轉過來，名片印了也不怕。
                </p>
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-[19px] leading-tight font-extrabold tracking-tight">
                你提供什麼服務
              </h1>
              <p className="mt-1 mb-4 text-[11.5px] text-ink-3">
                先建一項就好，其他之後在後台慢慢加。
              </p>

              <Field label="服務名稱">
                <input
                  className="w-full rounded-sm bg-sunk px-3.5 py-3 text-[13px] outline-none focus:bg-card"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="一對一教練課"
                />
              </Field>

              <div className="grid grid-cols-2 gap-2.5">
                <Field label="時長">
                  <div className="flex items-center rounded-sm bg-sunk pr-3.5">
                    <input
                      type="number"
                      min={15}
                      step={15}
                      className="num w-full bg-transparent px-3.5 py-3 text-[13px] font-extrabold outline-none"
                      value={durationMin}
                      onChange={(e) => setDurationMin(Number(e.target.value))}
                    />
                    <span className="text-[11px] font-bold text-ink-4">分鐘</span>
                  </div>
                </Field>
                <Field label="價格">
                  <div className="flex items-center rounded-sm bg-sunk pl-3.5">
                    <span className="text-[11px] font-bold text-ink-4">NT$</span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      className="num w-full bg-transparent px-2 py-3 text-[13px] font-extrabold outline-none"
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                    />
                  </div>
                </Field>
              </div>

              <p className="text-[10.5px] leading-relaxed text-ink-4">
                定金、多據點、到府這些進階設定，之後都可以在後台補。
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-[19px] leading-tight font-extrabold tracking-tight">
                你什麼時候有空
              </h1>
              <p className="mt-1 mb-4 text-[11.5px] text-ink-3">先抓個大概，之後隨時能改。</p>

              <Field label="哪幾天上班">
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => {
                    const on = weekdays.includes(d.value)
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() =>
                          setWeekdays((w) =>
                            on ? w.filter((x) => x !== d.value) : [...w, d.value]
                          )
                        }
                        className={`min-w-8 flex-1 rounded-full py-2.5 text-xs font-extrabold transition ${
                          on
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-sunk text-ink-3 hover:text-ink'
                        }`}
                      >
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-2.5">
                <Field label="開始">
                  <input
                    type="time"
                    step={1800}
                    className="num w-full rounded-sm bg-sunk px-3.5 py-3 text-[13px] font-extrabold outline-none"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </Field>
                <Field label="結束">
                  <input
                    type="time"
                    step={1800}
                    className="num w-full rounded-sm bg-sunk px-3.5 py-3 text-[13px] font-extrabold outline-none"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </Field>
              </div>

              <p className="text-[10.5px] leading-relaxed text-ink-4">
                時段一律以 30 分鐘為單位。
              </p>
            </>
          )}

          {error && (
            <p className="mt-3 rounded-sm bg-danger-bg px-3.5 py-2.5 text-[12px] font-bold text-danger">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 px-5 pt-3 pb-5">
          {step < TOTAL_STEPS ? (
            <button
              onClick={next}
              disabled={pending}
              className="w-full rounded-full bg-primary py-3.5 text-[13.5px] font-extrabold text-primary-foreground transition hover:brightness-95 disabled:opacity-50"
            >
              下一步
            </button>
          ) : (
            <>
              <button
                onClick={submit}
                disabled={pending}
                className="w-full rounded-full bg-primary py-3.5 text-[13.5px] font-extrabold text-primary-foreground transition hover:brightness-95 disabled:opacity-50"
              >
                {pending ? '建立中…' : '完成設定'}
              </button>
              <button
                onClick={() => {
                  setWeekdays([])
                  submit()
                }}
                disabled={pending}
                className="w-full py-2.5 text-[12px] font-extrabold text-ink-4 hover:text-ink disabled:opacity-50"
              >
                先略過，我之後再設
              </button>
            </>
          )}
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={pending}
              className="w-full py-1 text-[12px] font-bold text-ink-4 hover:text-ink"
            >
              上一步
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 block text-[11px] font-extrabold text-ink-2">{label}</label>
      {children}
    </div>
  )
}
