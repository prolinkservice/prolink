'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

async function getOwnPractitionerId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data } = await supabase.from('practitioners').select('id').eq('user_id', user.id).single()
  if (!data) redirect('/')
  return data.id
}

export async function updateVerification(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const practitionerId = await getOwnPractitionerId(supabase)

  const bankName = formData.get('bankName') as string
  const bankAccount = formData.get('bankAccount') as string
  const passbookUrl = formData.get('passbookUrl') as string
  const idFrontUrl = formData.get('idFrontUrl') as string
  const idBackUrl = formData.get('idBackUrl') as string

  const newBankStatus = passbookUrl ? 'pending' : 'not_submitted'
  const newIdStatus = idFrontUrl && idBackUrl ? 'pending' : 'not_submitted'

  await supabase
    .from('practitioners')
    .update({
      bank_name: bankName,
      bank_account: bankAccount,
      passbook_url: passbookUrl || null,
      bank_status: newBankStatus,
      id_front_url: idFrontUrl || null,
      id_back_url: idBackUrl || null,
      id_verification_status: newIdStatus,
    })
    .eq('id', practitionerId)

  revalidatePath('/practitioner/dashboard/profile')
}

export async function updateAddress(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const practitionerId = await getOwnPractitionerId(supabase)

  const address = formData.get('shopAddress') as string
  const latRaw = formData.get('latitude') as string
  const lngRaw = formData.get('longitude') as string

  const latitude = latRaw ? parseFloat(latRaw) : null
  const longitude = lngRaw ? parseFloat(lngRaw) : null

  await supabase
    .from('practitioners')
    .update({ shop_address: address, latitude, longitude })
    .eq('id', practitionerId)

  revalidatePath('/practitioner/dashboard/profile')
}

export async function updateBrandInfo(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const practitionerId = await getOwnPractitionerId(supabase)

  const yearsExperience = formData.get('yearsExperience') as string
  const certificateName = formData.get('certificateName') as string
  const specialtyTags = formData.get('specialtyTags') as string
  const coverImageUrl = formData.get('coverImageUrl') as string

  await supabase
    .from('practitioners')
    .update({
      years_experience: yearsExperience ? parseInt(yearsExperience) : null,
      certificate_name: certificateName || null,
      specialty_tags: specialtyTags ? specialtyTags.split(',').map(s => s.trim()).filter(Boolean) : [],
      cover_image_url: coverImageUrl || null,
    })
    .eq('id', practitionerId)

  revalidatePath('/practitioner/dashboard/profile')
}

export async function addSocialLink(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const practitionerId = await getOwnPractitionerId(supabase)

  const platform = formData.get('platform') as string
  const url = formData.get('url') as string

  const { data: current } = await supabase.from('practitioners').select('social_links').eq('id', practitionerId).single()
  const links = (current?.social_links as { platform: string; url: string }[]) ?? []
  links.push({ platform, url })

  await supabase.from('practitioners').update({ social_links: links }).eq('id', practitionerId)
  revalidatePath('/practitioner/dashboard/profile')
}

export async function removeSocialLink(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const practitionerId = await getOwnPractitionerId(supabase)
  const index = Number(formData.get('index'))

  const { data: current } = await supabase.from('practitioners').select('social_links').eq('id', practitionerId).single()
  const links = ((current?.social_links as { platform: string; url: string }[]) ?? []).filter((_, i) => i !== index)

  await supabase.from('practitioners').update({ social_links: links }).eq('id', practitionerId)
  revalidatePath('/practitioner/dashboard/profile')
}
