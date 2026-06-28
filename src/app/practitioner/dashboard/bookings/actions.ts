'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notifyUser } from '@/lib/notifications'

const WEEKDAY_LABEL = ['日', '一', '二', '三', '四', '五', '六']
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

function fmtSlotTime(iso: string) {
  const d = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${mm}/${dd}（${WEEKDAY_LABEL[d.getUTCDay()]}）${hh}:${min}`
}

export async function updateBookingStatusAction(bookingId: string, status: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('未登入')

  const { error } = await supabase
    .from('bookings')
    .update({ status, ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}) })
    .eq('id', bookingId)
  if (error) throw error

  if (status === 'confirmed') {
    const { data: booking } = await supabase
      .from('bookings')
      .select('customer_id, services ( name ), availability_slots ( start_time )')
      .eq('id', bookingId)
      .single()

    if (booking?.customer_id) {
      const service = Array.isArray(booking.services) ? booking.services[0] : booking.services
      const slot = Array.isArray(booking.availability_slots) ? booking.availability_slots[0] : booking.availability_slots
      const timeStr = slot?.start_time ? fmtSlotTime(slot.start_time) : ''

      const lineText = [
        '✅ 老師接單囉！',
        '',
        service?.name ? `服務：${service.name}` : null,
        timeStr ? `時間：${timeStr}` : null,
        '',
        '老師已經確認你的預約時段，記得準時赴約喔',
        `查看預約詳情：${SITE_URL}/my-bookings`,
      ].filter(Boolean).join('\n')

      await notifyUser(supabase, booking.customer_id, {
        type: 'booking_confirmed',
        title: '老師已確認你的預約',
        body: service?.name ? `老師已接受你預約的「${service.name}」服務，請準時赴約` : '老師已接受你的預約，請準時赴約',
        link: '/my-bookings',
        lineText,
      })
    }
  }
}

export async function requestCancellationAsPractitioner(bookingId: string, reason: string) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('未登入')

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, customer_id, status, practitioners ( user_id ), services ( name )')
    .eq('id', bookingId)
    .single()

  const practitioner = Array.isArray(booking?.practitioners) ? booking?.practitioners[0] : booking?.practitioners
  if (!booking || practitioner?.user_id !== user.id) throw new Error('找不到此預約')
  if (booking.status !== 'pending' && booking.status !== 'confirmed') throw new Error('此預約目前狀態無法申請取消')

  const { error } = await supabase.from('cancellation_requests').insert({
    booking_id: bookingId,
    requested_by: 'practitioner',
    reason: reason || null,
  })
  if (error) throw error

  const service = Array.isArray(booking.services) ? booking.services[0] : booking.services
  await notifyUser(supabase, booking.customer_id, {
    type: 'cancellation_requested',
    title: '老師申請取消預約',
    body: service?.name ? `老師申請取消「${service.name}」的預約，待客服審核` : '老師申請取消預約，待客服審核',
    link: '/my-bookings',
    skipLine: true,
  })
}
