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

export async function updateAvatar(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const avatarUrl = formData.get('avatarUrl') as string
  await supabase.from('profiles').update({ avatar_url: avatarUrl || null }).eq('id', user.id)

  revalidatePath('/practitioner/dashboard/profile')
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

const VALID_SERVICE_MODES = ['at_shop', 'on_site', 'both']

export async function updateServiceMode(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const practitionerId = await getOwnPractitionerId(supabase)

  const atShop = formData.get('atShop') === 'on'
  const onSite = formData.get('onSite') === 'on'

  let serviceMode: string
  if (atShop && onSite) serviceMode = 'both'
  else if (onSite) serviceMode = 'on_site'
  else serviceMode = 'at_shop' // 兩者都沒勾選時，預設保留到店服務，避免老師完全無法被預約

  if (!VALID_SERVICE_MODES.includes(serviceMode)) return

  await supabase.from('practitioners').update({ service_mode: serviceMode }).eq('id', practitionerId)

  revalidatePath('/practitioner/dashboard/profile')
  revalidatePath('/practitioners/[id]', 'page')
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

export async function updateBrandInfo(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const practitionerId = await getOwnPractitionerId(supabase)

  const yearsExperience = formData.get('yearsExperience') as string
  const certificatesRaw = formData.get('certificates') as string
  const specialtyTags = formData.get('specialtyTags') as string
  const brandColor = formData.get('brandColor') as string

  let certificates: { name: string; year: number | null }[] = []
  try {
    certificates = certificatesRaw ? JSON.parse(certificatesRaw) : []
  } catch {
    certificates = []
  }

  await supabase
    .from('practitioners')
    .update({
      years_experience: yearsExperience ? parseInt(yearsExperience) : null,
      certificates,
      // certificate_name 舊欄位同步保留第一筆名稱，避免其他尚未更新的程式碼讀到空值
      certificate_name: certificates[0]?.name || null,
      specialty_tags: specialtyTags ? specialtyTags.split(',').map(s => s.trim()).filter(Boolean) : [],
      // 只接受合法的 6 位數 hex 色碼，避免寫入不合法字串造成公開頁面套用 inline style 出錯
      ...(brandColor && HEX_COLOR_PATTERN.test(brandColor) ? { brand_color: brandColor } : {}),
    })
    .eq('id', practitionerId)

  revalidatePath('/practitioner/dashboard/profile')
  revalidatePath('/practitioners/[id]', 'page')
}

export async function updateCoverImage(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const practitionerId = await getOwnPractitionerId(supabase)

  const coverImageUrl = formData.get('coverImageUrl') as string
  const coverImagePosition = formData.get('coverImagePosition') as string

  await supabase
    .from('practitioners')
    .update({
      cover_image_url: coverImageUrl || null,
      cover_image_position: coverImagePosition || '50% 50%',
    })
    .eq('id', practitionerId)

  revalidatePath('/practitioner/dashboard/profile')
  revalidatePath('/practitioners/[id]', 'page')
}

export async function updatePageBlocks(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const practitionerId = await getOwnPractitionerId(supabase)

  const blocksRaw = formData.get('blocks') as string
  let blocks: { id: string; type: string; visible: boolean; data?: Record<string, string> }[] = []
  try {
    blocks = blocksRaw ? JSON.parse(blocksRaw) : []
  } catch {
    return { error: '排版資料格式錯誤' }
  }

  const validTypes = ['cover', 'about', 'certificates', 'services', 'reviews', 'social', 'map', 'availability', 'text', 'image']
  const sanitized = blocks.filter((b) => validTypes.includes(b.type))

  await supabase.from('practitioners').update({ page_blocks: sanitized }).eq('id', practitionerId)

  revalidatePath('/practitioner/dashboard/profile')
  revalidatePath('/practitioners/[id]', 'page')
  return { success: true }
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
