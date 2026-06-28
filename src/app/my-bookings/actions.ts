'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notifyPractitioner } from '@/lib/notifications'

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
