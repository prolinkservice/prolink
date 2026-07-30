import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { Tenant, TenantMember } from '@/lib/tenant-slug'

// 租戶解析（僅伺服器端）。純函式與型別放在 tenant-slug.ts，
// 那個檔案前後端共用，這裡不要 re-export，否則客戶端會把整包拉進去。
// 一個 Tenant = 一個職人品牌／工作室，網址形態 /p/{slug}（規格 §2.4）

const TENANT_FIELDS = 'id, slug, name, timezone, plan, status'

/**
 * 檢查 slug 能不能用。除了現有租戶，也要避開歷史 slug——
 * 那些網址還在做 301 轉址，被搶走會把舊連結導到別人的頁面。
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('slug_available', { p_slug: slug })
  return !error && data === true
}

/** 目前登入者所屬的租戶。還沒建立工作室的使用者回傳 null */
export async function getCurrentTenant(): Promise<
  { tenant: Tenant; member: TenantMember } | null
> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('tenant_members')
    .select(
      `id, tenant_id, user_id, role, display_name, is_bookable,
       tenants!inner(${TENANT_FIELDS})`
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[getCurrentTenant] 查不到租戶', {
      userId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    return null
  }

  if (!data) {
    console.error('[getCurrentTenant] 查詢成功但沒有資料列', { userId: user.id })
    return null
  }

  // supabase-js 對單筆關聯可能回物件或陣列，兩種都吃
  const row = data as unknown as TenantMember & { tenants: Tenant | Tenant[] }
  const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants
  if (!tenant) return null

  return {
    tenant,
    member: {
      id: row.id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      role: row.role,
      display_name: row.display_name,
      is_bookable: row.is_bookable,
    },
  }
}

export type SlugLookup =
  | { kind: 'found'; tenant: Tenant }
  | { kind: 'moved'; slug: string }
  | { kind: 'missing' }

/**
 * 給 /p/[slug] 用。找不到現行 slug 時再查歷史紀錄，
 * 讓名片上印的舊網址還能導到正確的頁面。
 */
export async function lookupTenantBySlug(slug: string): Promise<SlugLookup> {
  const supabase = await createServerSupabaseClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select(TENANT_FIELDS)
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()

  if (tenant) return { kind: 'found', tenant: tenant as Tenant }

  const { data: history } = await supabase
    .from('tenant_slug_history')
    .select('tenant_id, tenants!inner(slug, status)')
    .eq('old_slug', slug)
    .maybeSingle()

  if (history) {
    const joined = (
      history as unknown as { tenants: { slug: string; status: string } | { slug: string; status: string }[] }
    ).tenants
    const current = Array.isArray(joined) ? joined[0] : joined
    if (current?.status === 'active') return { kind: 'moved', slug: current.slug }
  }

  return { kind: 'missing' }
}
