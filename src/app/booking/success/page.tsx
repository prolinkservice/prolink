import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ShareSection } from './ShareSection'
import { cancelUnpaidBookingAndRedirect } from './actions'

const toTaipei = (iso: string) => new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000)

const fmt = (iso: string) => {
  const d = toTaipei(iso)
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const h = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${m}/${day} ${h}:${min}`
}

const PAYMENT_LABEL: Record<string, string> = {
  full_online: '線上付清尾款',
  cash: '現場付現結尾款',
  transfer: '轉帳結尾款',
}

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>
}) {
  const { bookingId } = await searchParams
  const supabase = await createServerSupabaseClient()

  const { data: booking } = bookingId
    ? await supabase
        .from('bookings')
        .select(`
          id, status, total_amount, payment_method, deposit_amount, payment_status,
          services ( name ),
          availability_slots ( start_time, end_time ),
          practitioners ( id, profiles ( display_name ) )
        `)
        .eq('id', bookingId)
        .single()
    : { data: null }

  const slotRaw = booking?.availability_slots as unknown
  const slot = (Array.isArray(slotRaw) ? slotRaw[0] : slotRaw) as { start_time: string; end_time: string } | null
  const serviceRaw = booking?.services as unknown
  const service = (Array.isArray(serviceRaw) ? serviceRaw[0] : serviceRaw) as { name: string } | null
  const practRaw = booking?.practitioners as unknown
  const pract = (Array.isArray(practRaw) ? practRaw[0] : practRaw) as { id: string; profiles: unknown } | null
  const profileRaw = pract?.profiles as unknown
  const profile = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { display_name: string | null } | null

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://prolink-delta.vercel.app'
  const practitionerUrl = pract ? `${siteUrl}/practitioners/${pract.id}` : siteUrl

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      {/* 成功圖示 */}
      <div className="flex flex-col items-center gap-3 mb-6">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-9 h-9 text-green-500" />
        </div>
        <h1 className="text-xl font-bold">預約成功！</h1>
        <p className="text-muted-foreground text-sm text-center">我們已收到你的預約，老師確認後將通知你</p>
      </div>

      {/* 預約摘要 */}
      {booking && slot && service && (
        <Card className="w-full max-w-sm mb-6">
          <CardContent className="p-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">老師</span>
              <span className="font-medium">{profile?.display_name ?? '老師'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">服務</span>
              <span className="font-medium">{service.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">時間</span>
              <span className="font-medium">{fmt(slot.start_time)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">金額</span>
              <span className="font-bold text-primary">NT${booking.total_amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">尾款付款方式</span>
              <span className="font-medium">{PAYMENT_LABEL[booking.payment_method]}</span>
            </div>
            {booking.deposit_amount && (
              <div className="flex justify-between text-orange-600">
                <span>應付平台服務費（線上）</span>
                <span className="font-bold">NT${booking.deposit_amount}</span>
              </div>
            )}
            {booking.payment_method !== 'full_online' && (
              <div className="flex justify-between text-foreground">
                <span className="text-muted-foreground">尾款現場應付金額</span>
                <span className="font-bold">NT${booking.total_amount - booking.deposit_amount}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {booking && (
        <Card className={`w-full max-w-sm mb-6 ${booking.payment_status === 'unpaid' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <CardContent className="p-3 text-xs text-center">
            {booking.payment_status === 'unpaid' ? (
              <span className="text-amber-700">⚠️ 尚未確認付款結果，若已完成付款請稍候片刻</span>
            ) : (
              <span className="text-green-700">✅ 平台服務費已付款成功（測試環境）</span>
            )}
          </CardContent>
        </Card>
      )}

      {booking && booking.payment_status === 'unpaid' && booking.status === 'pending' && (
        <div className="w-full max-w-sm flex gap-2 mb-6">
          <Link href={`/booking/pay?bookingId=${booking.id}`} className="flex-1">
            <Button className="w-full" size="lg">重新付款</Button>
          </Link>
          <form action={cancelUnpaidBookingAndRedirect} className="flex-1">
            <input type="hidden" name="bookingId" value={booking.id} />
            <Button type="submit" variant="outline" className="w-full" size="lg">取消此預約</Button>
          </form>
        </div>
      )}

      {booking && pract && (
        <ShareSection practitionerName={profile?.display_name ?? '老師'} practitionerUrl={practitionerUrl} />
      )}

      <Link href="/">
        <Button className="w-full max-w-sm" size="lg">回到首頁</Button>
      </Link>
    </div>
  )
}
