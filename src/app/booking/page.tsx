import { notFound, redirect } from 'next/navigation'
import { ChevronLeft, Clock, MapPin, CreditCard, Banknote, Building2, ShieldCheck, CheckCircle2, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createBooking } from './actions'
import { SubmitBookingButton } from './SubmitBookingButton'
import { PLATFORM_COMMISSION_RATE } from '@/lib/commission'
import { BrandMark } from '@/components/BrandMark'

const SERVICE_MODE_LABEL: Record<string, string> = {
  at_shop: '到店服務',
  on_site: '到府服務',
}

const TAIL_PAYMENT_OPTIONS = [
  { value: 'full_online', label: '全額刷卡', Icon: CreditCard, desc: '服務費＋尾款一次線上付清' },
  { value: 'cash', label: '現場付現', Icon: Banknote, desc: '服務完成後現場付清剩餘金額' },
]

const toTaipei = (iso: string) => new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000)

const fmtDate = (iso: string) => {
  const d = toTaipei(iso)
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const wd = weekdays[d.getUTCDay()]
  return `${m} / ${day}（${wd}）`
}

const fmtTime = (iso: string) => {
  const d = toTaipei(iso)
  const h = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${h}:${min}`
}

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ slotId?: string; practitionerId?: string; error?: string }>
}) {
  const { slotId, practitionerId, error: errorMsg } = await searchParams
  if (!slotId || !practitionerId) notFound()

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [{ data: slot }, { data: practitioner }] = await Promise.all([
    supabase
      .from('availability_slots')
      .select('id, start_time, end_time, is_booked, is_open')
      .eq('id', slotId)
      .single(),
    supabase
      .from('practitioners')
      .select(`id, service_mode, profiles ( display_name, avatar_url ), services ( id, name, duration_minutes, price )`)
      .eq('id', practitionerId)
      .eq('status', 'approved')
      .single(),
  ])

  if (!slot || !practitioner || slot.is_booked || !slot.is_open) notFound()

  const profileRaw = practitioner.profiles as unknown
  const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { display_name: string | null; avatar_url: string | null } | null
  const practitionerName = profile?.display_name ?? '老師'
  const services = practitioner.services as { id: string; name: string; duration_minutes: number; price: number }[]
  const modes = practitioner.service_mode === 'both' ? ['at_shop', 'on_site'] : [practitioner.service_mode]
  const hasOnSite = practitioner.service_mode === 'on_site' || practitioner.service_mode === 'both'

  return (
    <div className="min-h-screen bg-[#F7F1E8]">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href={`/practitioners/${practitionerId}`}>
          <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted active:scale-90 active:bg-muted transition-all duration-150">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <span className="font-semibold text-base">確認預約</span>
      <BrandMark />
      </div>

      <form action={createBooking}>
        <input type="hidden" name="slotId" value={slotId} />
        <input type="hidden" name="practitionerId" value={practitionerId} />

        <div className="px-4 py-5 flex flex-col gap-5 pb-32 max-w-lg mx-auto">

          {errorMsg && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive">
              {errorMsg}
            </div>
          )}

          {/* 預約摘要卡 */}
          <div className="bg-gradient-to-br from-primary to-[#E0935D] rounded-2xl p-5 text-white shadow-md">
            <p className="text-white/70 text-xs font-medium uppercase tracking-widest mb-3">預約資訊</p>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold shrink-0">
                {practitionerName[0]}
              </div>
              <div>
                <p className="font-bold text-lg leading-tight">{practitionerName}</p>
                <p className="text-white/70 text-xs">專業老師</p>
              </div>
            </div>
            <div className="bg-white/15 rounded-xl px-4 py-3 flex items-center gap-3">
              <CalendarDays className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">{fmtDate(slot.start_time)}</p>
                <p className="text-white/80 text-xs mt-0.5">
                  {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}
                </p>
              </div>
            </div>
          </div>

          {/* 選擇服務 */}
          <section>
            <h2 className="font-semibold text-sm text-muted-foreground mb-2.5 px-1">選擇服務項目</h2>
            <div className="flex flex-col gap-2">
              {services.map((s, i) => (
                <label key={s.id} className="cursor-pointer">
                  <input type="radio" name="serviceId" value={s.id} defaultChecked={i === 0} className="sr-only peer" required />
                  <div className="bg-white rounded-xl border-2 border-transparent peer-checked:border-primary peer-checked:bg-primary/5 transition-all duration-150 active:scale-[0.98] shadow-sm">
                    <div className="px-4 py-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-primary peer-checked:opacity-100 opacity-30" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{s.name}</p>
                          <div className="flex items-center gap-1 mt-0.5 text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span className="text-xs">{s.duration_minutes} 分鐘</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-primary font-bold text-base">NT${s.price}</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* 服務方式 */}
          <section>
            <h2 className="font-semibold text-sm text-muted-foreground mb-2.5 px-1">服務方式</h2>
            <div className="flex gap-3">
              {modes.map((mode, i) => (
                <label key={mode} className="cursor-pointer flex-1">
                  <input type="radio" name="serviceMode" value={mode} defaultChecked={i === 0} className="sr-only peer" required />
                  <div className="bg-white rounded-xl border-2 border-transparent peer-checked:border-primary peer-checked:bg-primary/5 transition-all duration-150 active:scale-[0.97] shadow-sm h-full">
                    <div className="px-3 py-4 flex flex-col items-center gap-2 text-center">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {mode === 'at_shop'
                          ? <Building2 className="w-5 h-5 text-primary" />
                          : <MapPin className="w-5 h-5 text-primary" />}
                      </div>
                      <p className="font-semibold text-sm">{SERVICE_MODE_LABEL[mode]}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            {hasOnSite && (
              <input
                name="customerAddress"
                placeholder="到府地址（選擇到府時請填寫）"
                className="mt-3 w-full bg-white border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
              />
            )}
          </section>

          {/* 平台服務費說明 */}
          <section className="bg-accent/40 border border-primary/20 rounded-xl px-4 py-3.5 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-foreground leading-relaxed">
              預約時需先線上支付<strong className="font-semibold">平台服務費</strong>（服務金額 {PLATFORM_COMMISSION_RATE * 100}%），保障客人與老師雙方權益；剩餘尾款請選擇下方方式結清。
            </p>
          </section>

          {/* 尾款付款方式 */}
          <section>
            <h2 className="font-semibold text-sm text-muted-foreground mb-2.5 px-1">尾款付款方式</h2>
            <div className="flex flex-col gap-2">
              {TAIL_PAYMENT_OPTIONS.map(({ value, label, Icon, desc }, i) => (
                <label key={value} className="cursor-pointer">
                  <input type="radio" name="paymentMethod" value={value} defaultChecked={i === 0} className="sr-only peer" required />
                  <div className="bg-white rounded-xl border-2 border-transparent peer-checked:border-primary peer-checked:bg-primary/5 transition-all duration-150 active:scale-[0.98] shadow-sm">
                    <div className="px-4 py-3.5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* 固定底部 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-border px-4 py-4 z-40">
          <SubmitBookingButton />
        </div>
      </form>
    </div>
  )
}
