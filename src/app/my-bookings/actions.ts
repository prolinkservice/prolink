'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { notifyPractitioner } from '@/lib/notifications'

// 完全沒收到任何款項的預約（連10%平台服務費都還沒付成功），客人可以直接取消，
// 不需要走客服審核退款流程（反正沒有錢可以退），同時把時段釋放回去讓其他人可以預約
export async function cancelUnpaidBooking(bookingId: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('未登入')

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, customer_id, slot_id, status, payment_status')
    .eq('id', bookingId)
    .single()

  if (!booking || booking.customer_id !== user.id) throw new Error('找不到此預約')
  if (booking.payment_status !== 'unpaid') throw new Error('此預約已有付款紀錄，請改用「申請取消」走退款審核流程')
  if (booking.status !== 'pending') throw new Error('此預約目前狀態無法取消')

  const admin = createAdminSupabaseClient()
  await admin.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId)
  if (booking.slot_id) {
    await admin.from('availability_slots').update({ is_booked: false }).eq('id', booking.slot_id)
  }
}

export async function requestCancellationAsCustomer(bookingId: string, reason: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('未登入')

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, practitioner_id, customer_id, status, services ( name )')
    .eq('id', bookingId)
    .single()

  if (!booking || booking.customer_id !== user.id) throw new Error('找不到此預約')
  if (booking.status !== 'pending' && booking.status !== 'confirmed') throw new Error('此預約目前狀態無法申請取消')

  const { error } = await supabase.from('cancellation_requests').insert({
    booking_id: bookingId,
    requested_by: 'customer',
    reason: reason || null,
  })
  if (error) throw error

  const service = Array.isArray(booking.services) ? booking.services[0] : booking.services
  await notifyPractitioner(supabase, booking.practitioner_id, {
    type: 'cancellation_requested',
    title: '客人申請取消預約',
    body: service?.name ? `客人申請取消「${service.name}」的預約，待客服審核` : '客人申請取消預約，待客服審核',
    link: '/practitioner/dashboard/bookings',
    skipLine: true,
  })
}
