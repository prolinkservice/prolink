'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notifyUser } from '@/lib/notifications'

export async function updateBookingStatusAction(bookingId: string, status: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('未登入')

  const { error } = await supabase.from('bookings').update({ status }).eq('id', bookingId)
  if (error) throw error

  if (status === 'confirmed') {
    const { data: booking } = await supabase
      .from('bookings')
      .select('customer_id, services ( name )')
      .eq('id', bookingId)
      .single()

    if (booking?.customer_id) {
      const service = Array.isArray(booking.services) ? booking.services[0] : booking.services
      await notifyUser(supabase, booking.customer_id, {
        type: 'booking_confirmed',
        title: '老師已確認你的預約',
        body: service?.name ? `老師已接受你預約的「${service.name}」服務，請準時赴約` : '老師已接受你的預約，請準時赴約',
        link: '/my-bookings',
      })
    }
  }
}
