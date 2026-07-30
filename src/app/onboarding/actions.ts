'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { normalizeSlug, validateSlug } from '@/lib/tenant-slug'

// Server Function 可以被直接 POST 呼叫，不是只有走 UI，
// 所以每一支都要自己驗證登入狀態

export type SlugCheck = { ok: true } | { ok: false; reason: string }

export async function checkSlug(raw: string): Promise<SlugCheck> {
  const slug = normalizeSlug(raw)

  const invalid = validateSlug(slug)
  if (invalid) return { ok: false, reason: invalid }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('slug_available', { p_slug: slug })

  if (error) return { ok: false, reason: '暫時查不到，請稍後再試' }
  if (!data) return { ok: false, reason: '這個網址已經有人使用了' }
  return { ok: true }
}

/**
 * 換一個帳號。使用者可能同時有多個 Google 帳號，
 * 用錯帳號登入時會看到「還沒有工作室」而困惑——
 * 工作室其實建在另一個帳號底下。
 */
export async function switchAccount() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/auth?next=/onboarding')
}

export type CreateTenantInput = {
  name: string
  slug: string
  displayName: string
  serviceName: string
  durationMin: number
  price: number
  weekdays: number[]
  startTime: string
  endTime: string
}

export type CreateTenantResult =
  | { ok: true; slug: string }
  | { ok: false; error: string }

export async function createTenant(
  input: CreateTenantInput
): Promise<CreateTenantResult> {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '請先登入' }

  const slug = normalizeSlug(input.slug)
  const invalid = validateSlug(slug)
  if (invalid) return { ok: false, error: invalid }

  const name = input.name.trim()
  if (!name) return { ok: false, error: '請填品牌名稱' }

  const displayName = input.displayName.trim() || name

  const { error } = await supabase.rpc('create_tenant', {
    p_name: name,
    p_slug: slug,
    p_display_name: displayName,
    p_service_name: input.serviceName.trim() || null,
    p_duration_min: input.durationMin,
    p_price: input.price,
    // 沒選任何一天就傳 null，讓老師之後在後台再設
    p_weekdays: input.weekdays.length ? input.weekdays : null,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
  })

  if (error) {
    // 23505 是函式裡自己丟的「網址已被使用」
    if (error.code === '23505') return { ok: false, error: '這個網址已經有人使用了' }
    return { ok: false, error: error.message }
  }

  return { ok: true, slug }
}
