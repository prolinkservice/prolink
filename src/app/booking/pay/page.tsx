import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { buildCheckoutParams, ECPAY_CHECKOUT_URL } from '@/lib/ecpay'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export default async function BookingPayPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>
}) {
  const { bookingId } = await searchParams
  if (!bookingId) notFound()

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, customer_id, total_amount, deposit_amount, payment_method, payment_status, merchant_trade_no, services ( name )')
    .eq('id', bookingId)
    .eq('customer_id', user.id)
    .single()

  if (!booking || !booking.merchant_trade_no) notFound()

  if (booking.payment_status !== 'unpaid') {
    redirect(`/booking/success?bookingId=${booking.id}`)
  }

  const amount = booking.payment_method === 'full_online' ? booking.total_amount : booking.deposit_amount
  const serviceRaw = booking.services as unknown
  const service = (Array.isArray(serviceRaw) ? serviceRaw[0] : serviceRaw) as { name: string } | null

  const params = buildCheckoutParams({
    merchantTradeNo: booking.merchant_trade_no,
    amount,
    itemName: service?.name ?? 'ProLink預約',
    returnUrl: `${SITE_URL}/api/ecpay/callback`,
    clientBackUrl: `${SITE_URL}/booking/success?bookingId=${booking.id}`,
  })

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-muted-foreground text-sm">正在前往付款頁面，請稍候...</p>
      <form id="ecpay-form" method="POST" action={ECPAY_CHECKOUT_URL}>
        {Object.entries(params).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
      </form>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.getElementById('ecpay-form').submit();`,
        }}
      />
    </div>
  )
}
