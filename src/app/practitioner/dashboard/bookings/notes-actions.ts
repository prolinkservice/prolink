'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'

async function getOwnPractitionerId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('practitioners').select('id').eq('user_id', user.id).single()
  return data?.id ?? null
}

// 老師查看／編輯某位客人的體質備註（僅本人客戶資料，RLS 另有一層保護）
export async function getClientNote(customerId: string): Promise<{ note: string; updatedAt: string | null }> {
  const supabase = await createServerSupabaseClient()
  const practitionerId = await getOwnPractitionerId(supabase)
  if (!practitionerId) return { note: '', updatedAt: null }

  const { data } = await supabase
    .from('client_notes')
    .select('note, updated_at')
    .eq('practitioner_id', practitionerId)
    .eq('customer_id', customerId)
    .maybeSingle()

  return { note: data?.note ?? '', updatedAt: data?.updated_at ?? null }
}

export async function saveClientNote(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const practitionerId = await getOwnPractitionerId(supabase)
  if (!practitionerId) return { error: '尚未登入或非職人帳號' }

  const customerId = formData.get('customerId') as string
  const note = formData.get('note') as string

  if (!customerId) return { error: '缺少客戶資料' }

  const { error } = await supabase
    .from('client_notes')
    .upsert(
      {
        practitioner_id: practitionerId,
        customer_id: customerId,
        note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'practitioner_id,customer_id' }
    )

  if (error) return { error: error.message }
  return { success: true }
}
