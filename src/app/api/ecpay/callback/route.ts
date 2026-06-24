import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyCheckMacValue } from '@/lib/ecpay'
import { calcCommission, PLATFORM_COMMISSION_RATE } from '@/lib/commission'

// 綠界 ReturnURL 是伺服器對伺服器的非同步通知，沒有使用者登入狀態，
// 必須用 service role key 才能寫入資料（RLS 只允許本人操作自己的預約）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const params = Object.fromEntries(new URLSearchParams(body))

  if (!verifyCheckMacValue(params)) {
    return new Response('0|CheckMacValue Error', { status: 400 })
  }

  const merchantTradeNo = params.MerchantTradeNo
  const rtnCode = params.RtnCode

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, total_amount, payment_method, payment_status')
    .eq('merchant_trade_no', merchantTradeNo)
    .single()

  if (!booking) {
    return new Response('0|Booking Not Found', { status: 404 })
  }

  if (rtnCode === '1' && booking.payment_status === 'unpaid') {
    const paidAmount = Number(params.TradeAmt)
    const newStatus = booking.payment_method === 'full_online' ? 'paid' : 'partially_paid'

    await supabase
      .from('bookings')
      .update({ payment_status: newStatus })
      .eq('id', booking.id)

    const commissionAmount = calcCommission(booking.total_amount)
    await supabase.from('transactions').insert({
      booking_id: booking.id,
      amount: paidAmount,
      commission_rate: PLATFORM_COMMISSION_RATE,
      commission_amount: commissionAmount,
      practitioner_payout: booking.total_amount - commissionAmount,
      status: 'completed',
    })
  }

  return new Response('1|OK')
}
