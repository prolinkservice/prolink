import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { doCreditCardRefund } from '@/lib/ecpay'
import { notifyUser, notifyPractitioner } from '@/lib/notifications'

type BookingForRefund = {
  id: string
  customer_id: string
  practitioner_id: string
  total_amount: number
  deposit_amount: number
  payment_status: string
  payment_method: string
  merchant_trade_no: string
  trade_no: string | null
}

export function calcRefundAmount(
  booking: Pick<BookingForRefund, 'payment_status' | 'total_amount' | 'deposit_amount'>,
  requestedBy: 'customer' | 'practitioner' | 'system',
  slotStartTime: string
) {
  const paidOnlineAmount =
    booking.payment_status === 'paid' ? booking.total_amount :
    booking.payment_status === 'partially_paid' ? booking.deposit_amount : 0

  if (paidOnlineAmount === 0) return 0
  if (requestedBy === 'system') return paidOnlineAmount

  const hoursUntilSlot = (new Date(slotStartTime).getTime() - Date.now()) / (1000 * 60 * 60)
  return hoursUntilSlot >= 24 ? paidOnlineAmount : 0
}

// 取消已核准（人工審核通過或系統自動取消）後的實際執行：退刷（若有金額）、釋放時段、更新預約狀態、通知雙方
export async function executeApprovedCancellation({
  bookingId,
  refundAmount,
  requestedBy = 'customer',
}: {
  bookingId: string
  refundAmount: number
  requestedBy?: 'customer' | 'practitioner' | 'system'
}) {
  const admin = createAdminSupabaseClient()

  const { data: booking } = await admin
    .from('bookings')
    .select('id, customer_id, practitioner_id, total_amount, deposit_amount, payment_status, payment_method, merchant_trade_no, trade_no, slot_id, services ( name )')
    .eq('id', bookingId)
    .single()

  if (!booking) throw new Error('找不到此預約')

  // 退款金額大於0時，必須能成功呼叫退刷API才能繼續取消流程；
  // 否則寧可保留預約原狀讓人工處理，也不要在「已取消但錢還沒退」的狀態下發通知誤導客人
  let refunded = false
  if (refundAmount > 0) {
    if (!booking.trade_no) {
      throw new Error(`[cancellation] 預約 ${bookingId} 缺少 trade_no，無法呼叫退刷API，請人工處理退款後再手動取消此預約`)
    }
    const result = await doCreditCardRefund({
      merchantTradeNo: booking.merchant_trade_no,
      tradeNo: booking.trade_no,
      totalAmount: refundAmount,
    })
    if (!result.ok) {
      throw new Error(`[cancellation] 預約 ${bookingId} 綠界退刷失敗：${result.raw}`)
    }
    refunded = true
  }

  await admin
    .from('bookings')
    .update({
      status: 'cancelled',
      payment_status: refunded ? 'refunded' : booking.payment_status,
    })
    .eq('id', bookingId)

  if (booking.slot_id) {
    await admin.from('availability_slots').update({ is_booked: false }).eq('id', booking.slot_id)
  }

  const service = Array.isArray(booking.services) ? booking.services[0] : booking.services
  const serviceName = service?.name ? `「${service.name}」` : ''

  const refundLine = refundAmount > 0
    ? `退款金額：NT$${refundAmount.toLocaleString()}，依綠界規定，款項將於14~21個工作天內退回您的信用卡帳戶`
    : '依規定此次取消不予退款'

  const customerOpeningLine = requestedBy === 'system'
    ? '老師超過2小時未確認接單，已自動取消您的預約'
    : `您${serviceName}的預約已取消`

  await notifyUser(admin, booking.customer_id, {
    type: 'cancellation_approved',
    title: '預約已取消',
    body: `${customerOpeningLine}。${refundLine}`,
    link: '/my-bookings',
    lineText: ['✅ 預約已取消', '', customerOpeningLine, refundLine].filter(Boolean).join('\n'),
  })

  await notifyPractitioner(admin, booking.practitioner_id, {
    type: 'cancellation_approved',
    title: '預約已取消',
    body: requestedBy === 'system'
      ? '你超過2小時未確認接單，此預約已被系統自動取消'
      : `客人${serviceName}的預約已取消`,
    link: '/practitioner/dashboard/bookings',
  })

  return { refunded, refundAmount }
}
