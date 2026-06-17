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
  const supabase = await createServerSupabaseClient()
  await supabase.from('practitioners').update({ status: 'rejected' }).eq('id', practitionerId)
  revalidatePath('/admin')
}
