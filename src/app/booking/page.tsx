import { notFound, redirect } from 'next/navigation'
import { ChevronLeft, Clock, MapPin, CreditCard, Banknote, Building2, ArrowRightLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createBooking } from './actions'

const SERVICE_MODE_LABEL: Record<string, string> = {
  at_shop: '到店服務',
  on_site: '到府服務',
}

const PAYMENT_OPTIONS = [
  { value: 'full_online', label: '線上全額付款', Icon: CreditCard, desc: '預約成功後立即付清' },
  { value: 'deposit', label: '付訂金（30%）', Icon: ArrowRightLeft, desc: '先付訂金，尾款現場結清' },
  { value: 'cash', label: '現場付現', Icon: Banknote, desc: '服務完成後現場付款' },
  { value: 'transfer', label: '轉帳', Icon: Banknote, desc: '預約成功後提供帳號' },
]

const toTaipei = (iso: string) => new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000)

const fmt = (iso: string) => {
  const d = toTaipei(iso)
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const h = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${m}/${day} ${h}:${min}`
}

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ slotId?: string; practitionerId?: string }>
}) {
  const { slotId, practitionerId } = await searchParams
  if (!slotId || !practitionerId) notFound()

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [{ data: slot }, { data: practitioner }] = await Promise.all([
    supabase
      .from('availability_slots')
      .select('id, start_time, end_time, is_booked')
      .eq('id', slotId)
      .single(),
    supabase
      .from('practitioners')
      .select(`id, service_mode, profiles ( display_name ), services ( id, name, duration_minutes, price )`)
      .eq('id', practitionerId)
      .eq('status', 'approved')
      .single(),
  ])

  if (!slot || !practitioner || slot.is_booked) notFound()

  const profileRaw = practitioner.profiles as unknown
  const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { display_name: string | null } | null
  const practitionerName = profile?.display_name ?? '師傅'
  const services = practitioner.services as { id: string; name: string; duration_minutes: number; price: number }[]
  const modes = practitioner.service_mode === 'both' ? ['at_shop', 'on_site'] : [practitioner.service_mode]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href={`/practitioners/${practitionerId}`}>
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold">確認預約</span>
      </div>

      <form action={createBooking}>
        <input type="hidden" name="slotId" value={slotId} />
        <input type="hidden" name="practitionerId" value={practitionerId} />

        <div className="px-4 py-4 flex flex-col gap-4 pb-28">
          {/* 時段摘要 */}
          <Card>
            <CardContent className="p-4 flex flex-col gap-1.5">
              <h2 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">預約時段</h2>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="font-semibold">{fmt(slot.start_time)} – {fmt(slot.end_time).slice(6)}</span>
              </div>
              <p className="text-sm text-muted-foreground">師傅：{practitionerName}</p>
            </CardContent>
          </Card>

          {/* 選擇服務 */}
          <div>
            <h2 className="font-semibold mb-2">選擇服務項目</h2>
            <div className="flex flex-col gap-2">
              {services.map((s, i) => (
                <label key={s.id} className="cursor-pointer">
                  <input type="radio" name="serviceId" value={s.id} defaultChecked={i === 0} className="sr-only peer" required />
                  <Card className="peer-checked:border-primary peer-checked:bg-primary/5 transition-colors border-2">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <div className="flex items-center gap-1 mt-0.5 text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs">{s.duration_minutes} 分</span>
                        </div>
                      </div>
                      <span className="text-primary font-bold">NT${s.price}</span>
                    </CardContent>
                  </Card>
                </label>
              ))}
            </div>
          </div>

          {/* 服務方式 */}
          <div>
            <h2 className="font-semibold mb-2">服務方式</h2>
            <div className="flex flex-col gap-2">
              {modes.map((mode, i) => (
                <label key={mode} className="cursor-pointer">
                  <input type="radio" name="serviceMode" value={mode} defaultChecked={i === 0} className="sr-only peer" required />
                  <Card className="peer-checked:border-primary peer-checked:bg-primary/5 transition-colors border-2">
                    <CardContent className="p-3 flex items-center gap-3">
                      {mode === 'at_shop'
                        ? <Building2 className="w-4 h-4 text-primary" />
                        : <MapPin className="w-4 h-4 text-primary" />}
                      <span className="font-medium text-sm">{SERVICE_MODE_LABEL[mode]}</span>
                    </CardContent>
                  </Card>
                </label>
              ))}
            </div>
            {(practitioner.service_mode === 'on_site' || practitioner.service_mode === 'both') && (
              <input
                name="customerAddress"
                placeholder="到府地址（選擇到府時請填寫）"
                className="mt-2 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            )}
          </div>

          {/* 付款方式 */}
          <div>
            <h2 className="font-semibold mb-2">付款方式</h2>
            <div className="flex flex-col gap-2">
              {PAYMENT_OPTIONS.map(({ value, label, Icon, desc }, i) => (
                <label key={value} className="cursor-pointer">
                  <input type="radio" name="paymentMethod" value={value} defaultChecked={i === 0} className="sr-only peer" required />
                  <Card className="peer-checked:border-primary peer-checked:bg-primary/5 transition-colors border-2">
                    <CardContent className="p-3 flex items-center gap-3">
                      <Icon className="w-4 h-4 text-primary shrink-0" />
                      <div>
                        <p className="font-medium text-sm">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 固定底部送出 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border px-4 py-4 z-40">
          <Button className="w-full" size="lg" type="submit">確認預約</Button>
        </div>
      </form>
    </div>
  )
}
