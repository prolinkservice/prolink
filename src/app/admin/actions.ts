'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notifyPractitioner } from '@/lib/notifications'

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
  const supabase = await createServerSupabaseClient()
  await supabase.from('practitioners').update({ bank_status: 'rejected' }).eq('id', practitionerId)
  await notifyPractitioner(supabase, practitionerId, {
    type: 'verification_result',
    title: '銀行帳戶審核未通過',
    body: '請重新確認帳戶資料後再次送出',
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
  const supabase = await createServerSupabaseClient()
  await supabase.from('practitioners').update({ id_verification_status: 'rejected' }).eq('id', practitionerId)
  await notifyPractitioner(supabase, practitionerId, {
    type: 'verification_result',
    title: '身份驗證審核未通過',
    body: '請重新確認身分證照片後再次送出',
    link: '/practitioner/dashboard/profile',
  })
  revalidatePath('/admin', 'layout')
}
