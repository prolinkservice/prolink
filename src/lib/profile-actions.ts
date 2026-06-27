'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const NAME_CHANGE_COOLDOWN_DAYS = 7

export async function updateDisplayName(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const displayName = (formData.get('displayName') as string)?.trim()
  if (!displayName) return { error: '姓名不能空白' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name_updated_at')
    .eq('id', user.id)
    .single()

  if (profile?.display_name_updated_at) {
    const nextAllowed = new Date(profile.display_name_updated_at)
    nextAllowed.setDate(nextAllowed.getDate() + NAME_CHANGE_COOLDOWN_DAYS)
    if (nextAllowed > new Date()) {
      return { error: `姓名七天內只能修改一次，下次可修改時間：${nextAllowed.toLocaleDateString('zh-TW')}` }
    }
  }

  await supabase
    .from('profiles')
    .update({ display_name: displayName, display_name_updated_at: new Date().toISOString() })
    .eq('id', user.id)

  revalidatePath('/practitioner/dashboard/profile')
  revalidatePath('/account')
  return { success: true }
}

const VALID_GENDERS = ['male', 'female', 'other']

export async function updateDemographics(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const genderRaw = formData.get('gender') as string
  const birthdateRaw = formData.get('birthdate') as string

  const gender = VALID_GENDERS.includes(genderRaw) ? genderRaw : null
  const birthdate = birthdateRaw ? birthdateRaw : null

  await supabase
    .from('profiles')
    .update({ gender, birthdate })
    .eq('id', user.id)

  revalidatePath('/account')
  return { success: true }
}
