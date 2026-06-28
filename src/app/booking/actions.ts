'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { calcCommission } from '@/lib/commission'
import { genMerchantTradeNo } from '@/lib/ecpay'
import { notifyPractitioner } from '@/lib/notifications'

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

  // 先「原子性」鎖定時段：只有在時段目前未被預約時才會更新成功（affected row 數為 0 代表已被搶先預約或重複送出）
  // 這是防止連續點擊／併發請求造成同一時段被建立多筆預約的關鍵防護，務必在寫入 bookings 之前完成
  const { data: lockedSlot, error: lockError } = await supabase
    .from('availability_slots')
    .update({ is_booked: true })
    .eq('id', slotId)
    .eq('is_booked', false)
    .select('id')
    .maybeSingle()

  if (lockError || !lockedSlot) {
    redirect(`${backTo}&error=${encodeURIComponent('此時段已被預約，請重新選擇時段')}`)
  }

  // 建立預約（訂單編號跟著一起寫入，避免事後 UPDATE 被 RLS 擋掉）
  const bookingId = crypto.randomUUID()
  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      id: bookingId,
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
      merchant_trade_no: genMerchantTradeNo(bookingId),
    })
    .select('id')
    .single()

  if (error || !booking) {
    console.error(error)
    // 預約寫入失敗，把剛剛鎖定的時段釋放回去，避免時段卡死變成永遠無法預約
    // 客人只有「未預約→已預約」這個方向的權限，回復成「未預約」需要用 service role 權限執行
    await createAdminSupabaseClient().from('availability_slots').update({ is_booked: false }).eq('id', slotId)
    redirect(`${backTo}&error=${encodeURIComponent(`預約建立失敗：${error?.message ?? '未知錯誤'}`)}`)
  }

  // LINE 推播改在客人完成付款後（綠界 callback）才發送，這裡只寫站內通知，
  // 避免客人還沒付款就讓老師收到 LINE 訊息、內容也還沒有確定的付款金額可以呈現
  await notifyPractitioner(supabase, practitionerId, {
    type: 'new_booking',
    title: '收到新預約',
    body: '有客人剛預約了你的服務，等待付款完成',
    link: '/practitioner/dashboard/bookings',
    skipLine: true,
  })

  redirect(`/booking/pay?bookingId=${booking.id}`)
}
