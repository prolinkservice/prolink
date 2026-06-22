'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function approvePractitioner(formData: FormData) {
  const practitionerId = formData.get('practitionerId') as string
  const supabase = await createServerSupabaseClient()
  await supabase.from('practitioners').update({ status: 'approved' }).eq('id', practitionerId)
  revalidatePath('/admin')
}

export async function rejectPractitioner(formData: FormData) {
  const practitionerId = formData.get('practitionerId') as string
  const reason = formData.get('reason') as string
  const supabase = await createServerSupabaseClient()
  await supabase.from('practitioners').update({ status: 'rejected', rejection_reason: reason || null }).eq('id', practitionerId)
  revalidatePath('/admin')
}

export async function approveBank(formData: FormData) {
  const practitionerId = formData.get('practitionerId') as string
  const supabase = await createServerSupabaseClient()
  await supabase.from('practitioners').update({ bank_status: 'approved' }).eq('id', practitionerId)
  revalidatePath('/admin')
}

export async function rejectBank(formData: FormData) {
  const practitionerId = formData.get('practitionerId') as string
  const supabase = await createServerSupabaseClient()
  await supabase.from('practitioners').update({ bank_status: 'rejected' }).eq('id', practitionerId)
  revalidatePath('/admin')
}

export async function approveId(formData: FormData) {
  const practitionerId = formData.get('practitionerId') as string
  const supabase = await createServerSupabaseClient()
  await supabase.from('practitioners').update({ id_verification_status: 'approved' }).eq('id', practitionerId)
  revalidatePath('/admin')
}

export async function rejectId(formData: FormData) {
  const practitionerId = formData.get('practitionerId') as string
  const supabase = await createServerSupabaseClient()
  await supabase.from('practitioners').update({ id_verification_status: 'rejected' }).eq('id', practitionerId)
  revalidatePath('/admin')
}
