'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { calcCommission } from '@/lib/commission'

export async function createBooking(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/error')

  const slotId = formData.get('slotId') as string
  const practitionerId = formData.get('practitionerId') as string
  const serviceId = formData.get('serviceId') as string
  const serviceMode = formData.get('serviceMode') as string
  const paymentMethod = formData.get('paymentMethod') as string
  const customerAddress = formData.get('customerAddress') as string | null

  const backTo = `/booking?slotId=${slotId}&practitionerId=${practitionerId}`

  if (!serviceId) {
    redirect(`${backTo}&error=${encodeURIComponent('請選擇服務項目，若此老師尚無服務項目請聯絡客服')}`)
  }

  // 取得服務價格
  const { data: service } = await supabase
    .from('services')
    .select('price')
    .eq('id', serviceId)
    .single()

  if (!service) redirect(`${backTo}&error=${encodeURIComponent('找不到此服務項目，請重新選擇')}`)

  // 建立預約
  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      customer_id: user.id,
      practitioner_id: practitionerId,
      service_id: serviceId,
      slot_id: slotId,
      service_mode: serviceMode,
      customer_address: customerAddress || null,
      payment_method: paymentMethod,
      payment_status: 'unpaid',
      total_amount: service.price,
      deposit_amount: calcCommission(service.price),
    })
    .select('id')
    .single()

  if (error || !booking) {
    console.error(error)
    redirect(`${backTo}&error=${encodeURIComponent(`預約建立失敗：${error?.message ?? '未知錯誤'}`)}`)
  }

  // 標記時段為已預約
  await supabase
    .from('availability_slots')
    .update({ is_booked: true })
    .eq('id', slotId)

  redirect(`/booking/success?bookingId=${booking.id}`)
}
