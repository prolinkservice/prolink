'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notifyPractitioner, notifyUser } from '@/lib/notifications'
import { calcRefundAmount, executeApprovedCancellation } from '@/lib/cancellation'

export async function approvePractitioner(formData: FormData) {
  const practitionerId = formData.get('practitionerId') as string
  const supabase = await createServerSupabaseClient()
  await supabase.from('practitioners').update({ status: 'approved' }).eq('id', practitionerId)
  await notifyPractitioner(supabase, practitionerId, {
    type: 'verification_result',
    title: '職人入駐審核通過',
    body: '恭喜，你的職人入駐申請已通過，現在可以開始接案了',
    link: '/practitioner/dashboard',
  })
  revalidatePath('/admin', 'layout')
}

export async function rejectPractitioner(formData: FormData) {
  const practitionerId = formData.get('practitionerId') as string
  const reason = formData.get('reason') as string
  const supabase = await createServerSupabaseClient()
  await supabase.from('practitioners').update({ status: 'rejected', rejection_reason: reason || null }).eq('id', practitionerId)
  await notifyPractitioner(supabase, practitionerId, {
    type: 'verification_result',
    title: '職人入駐申請被退回',
    body: reason ? `退回原因：${reason}` : '請查看詳細退回原因並補件',
    link: '/practitioner/pending',
  })
  revalidatePath('/admin', 'layout')
}

export async function approveBank(formData: FormData) {
  const practitionerId = formData.get('practitionerId') as string
  const supabase = await createServerSupabaseClient()
  await supabase.from('practitioners').update({ bank_status: 'approved' }).eq('id', practitionerId)
  await notifyPractitioner(supabase, practitionerId, {
    type: 'verification_result',
    title: '銀行帳戶審核通過',
    link: '/practitioner/dashboard/profile',
  })
  revalidatePath('/admin', 'layout')
}

export async function rejectBank(formData: FormData) {
  const practitionerId = formData.get('practitionerId') as string
  const reason = formData.get('reason') as string
  const supabase = await createServerSupabaseClient()
  await supabase.from('practitioners').update({ bank_status: 'rejected', bank_reject_reason: reason || null }).eq('id', practitionerId)
  await notifyPractitioner(supabase, practitionerId, {
    type: 'verification_result',
    title: '銀行帳戶審核未通過',
    body: reason ? `退回原因：${reason}` : '請重新確認帳戶資料後再次送出',
    link: '/practitioner/dashboard/profile',
  })
  revalidatePath('/admin', 'layout')
}

export async function approveId(formData: FormData) {
  const practitionerId = formData.get('practitionerId') as string
  const supabase = await createServerSupabaseClient()
  await supabase.from('practitioners').update({ id_verification_status: 'approved' }).eq('id', practitionerId)
  await notifyPractitioner(supabase, practitionerId, {
    type: 'verification_result',
    title: '身份驗證審核通過',
    link: '/practitioner/dashboard/profile',
  })
  revalidatePath('/admin', 'layout')
}

export async function rejectId(formData: FormData) {
  const practitionerId = formData.get('practitionerId') as string
  const reason = formData.get('reason') as string
  const supabase = await createServerSupabaseClient()
  await supabase.from('practitioners').update({ id_verification_status: 'rejected', id_reject_reason: reason || null }).eq('id', practitionerId)
  await notifyPractitioner(supabase, practitionerId, {
    type: 'verification_result',
    title: '身份驗證審核未通過',
    body: reason ? `退回原因：${reason}` : '請重新確認身分證照片後再次送出',
    link: '/practitioner/dashboard/profile',
  })
  revalidatePath('/admin', 'layout')
}

export async function suspendPractitioner(formData: FormData) {
  const practitionerId = formData.get('practitionerId') as string
  const reason = formData.get('reason') as string
  const supabase = await createServerSupabaseClient()
  await supabase.from('practitioners').update({ status: 'suspended', suspend_reason: reason || null }).eq('id', practitionerId)
  await notifyPractitioner(supabase, practitionerId, {
    type: 'verification_result',
    title: '你的職人帳號已被下架',
    body: reason ? `下架原因：${reason}` : undefined,
    link: '/practitioner/dashboard',
  })
  revalidatePath('/admin', 'layout')
}

export async function restorePractitioner(formData: FormData) {
  const practitionerId = formData.get('practitionerId') as string
  const supabase = await createServerSupabaseClient()
  await supabase.from('practitioners').update({ status: 'approved', suspend_reason: null }).eq('id', practitionerId)
  await notifyPractitioner(supabase, practitionerId, {
    type: 'verification_result',
    title: '你的職人帳號已恢復上架',
    link: '/practitioner/dashboard',
  })
  revalidatePath('/admin', 'layout')
}

export async function togglePrivileged(formData: FormData) {
  const practitionerId = formData.get('practitionerId') as string
  const nextValue = formData.get('nextValue') === 'true'
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('practitioners').update({ is_privileged: nextValue }).eq('id', practitionerId)
  if (error) throw new Error(`切換特權狀態失敗：${error.message}`)
  revalidatePath('/admin', 'layout')
}

export async function registerSubscription(formData: FormData) {
  const practitionerId = formData.get('practitionerId') as string
  const startDate = formData.get('startDate') as string
  const endDate = formData.get('endDate') as string
  const amount = Number(formData.get('amount'))
  const note = formData.get('note') as string

  if (!startDate || !endDate || !Number.isFinite(amount)) {
    throw new Error('請完整填寫訂閱起訖日與金額')
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('practitioner_subscriptions').insert({
    practitioner_id: practitionerId,
    start_date: startDate,
    end_date: endDate,
    amount,
    note: note || null,
    created_by: user?.id ?? null,
  })
  if (error) throw new Error(`登記訂閱失敗：${error.message}`)

  await notifyPractitioner(supabase, practitionerId, {
    type: 'verification_result',
    title: '訂閱已開通',
    body: `訂閱期間：${startDate} ~ ${endDate}`,
    link: '/practitioner/dashboard',
  })
  revalidatePath('/admin', 'layout')
}

export async function approveCancellation(formData: FormData) {
  const requestId = formData.get('requestId') as string
  const supabase = await createServerSupabaseClient()

  const { data: request } = await supabase
    .from('cancellation_requests')
    .select('id, booking_id, requested_by, bookings ( payment_status, total_amount, deposit_amount, availability_slots ( start_time ) )')
    .eq('id', requestId)
    .single()

  if (!request) throw new Error('找不到此取消申請')
  const booking = Array.isArray(request.bookings) ? request.bookings[0] : request.bookings
  const slot = Array.isArray(booking?.availability_slots) ? booking?.availability_slots[0] : booking?.availability_slots
  if (!booking || !slot) throw new Error('找不到對應的預約資料')

  const refundAmount = calcRefundAmount(booking, request.requested_by as 'customer' | 'practitioner' | 'system', slot.start_time)

  try {
    await executeApprovedCancellation({
      bookingId: request.booking_id,
      refundAmount,
      requestedBy: request.requested_by as 'customer' | 'practitioner' | 'system',
    })
    const { error: updateError } = await supabase
      .from('cancellation_requests')
      .update({ status: 'approved', refund_amount: refundAmount, reviewed_at: new Date().toISOString() })
      .eq('id', requestId)
    if (updateError) {
      console.error('[approveCancellation] 更新申請單狀態失敗', updateError, { requestId })
      throw new Error(`退款/取消已執行成功，但申請單狀態更新失敗：${updateError.message}`)
    }
  } catch (err) {
    // 退款無法自動完成（例如缺少 trade_no 或綠界API失敗），不取消預約，留在待審核狀態並記錄原因，避免「已取消但錢沒退」
    const message = err instanceof Error ? err.message : String(err)
    await supabase
      .from('cancellation_requests')
      .update({ admin_note: `自動退款失敗，需人工處理後再次核准：${message}` })
      .eq('id', requestId)
    throw new Error(`退款失敗，此取消申請已保留在待審核狀態，請人工確認退款後再次核准：${message}`)
  }
  revalidatePath('/admin', 'layout')
}

export async function rejectCancellation(formData: FormData) {
  const requestId = formData.get('requestId') as string
  const reason = formData.get('reason') as string
  const supabase = await createServerSupabaseClient()

  const { data: request } = await supabase
    .from('cancellation_requests')
    .select('id, requested_by, bookings ( customer_id, practitioner_id )')
    .eq('id', requestId)
    .single()

  if (!request) throw new Error('找不到此取消申請')
  const booking = Array.isArray(request.bookings) ? request.bookings[0] : request.bookings
  if (!booking) throw new Error('找不到對應的預約資料')

  const { error: rejectUpdateError } = await supabase
    .from('cancellation_requests')
    .update({ status: 'rejected', admin_note: reason || null, reviewed_at: new Date().toISOString() })
    .eq('id', requestId)
  if (rejectUpdateError) {
    console.error('[rejectCancellation] 更新申請單狀態失敗', rejectUpdateError, { requestId })
    throw new Error(`駁回失敗：${rejectUpdateError.message}`)
  }

  const body = reason ? `退回原因：${reason}` : '請查看詳細退回原因'
  if (request.requested_by === 'customer') {
    await notifyUser(supabase, booking.customer_id, {
      type: 'cancellation_rejected',
      title: '取消申請未通過',
      body,
      link: '/my-bookings',
    })
  } else {
    await notifyPractitioner(supabase, booking.practitioner_id, {
      type: 'cancellation_rejected',
      title: '取消申請未通過',
      body,
      link: '/practitioner/dashboard/bookings',
    })
  }
  revalidatePath('/admin', 'layout')
}
