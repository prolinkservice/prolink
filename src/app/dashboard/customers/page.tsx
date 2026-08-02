import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentTenant } from '@/lib/tenant'
import type { CustomerRow } from '@/lib/customers'
import { CustomerList } from './CustomerList'

export const metadata: Metadata = { title: '客戶管理 · 職人連結' }

// 客戶列表。草稿：docs/mockups/settings.html §03
//
// 這頁的靈魂是上面那排篩選鈕：老師平常要找的不是「某個人」，是「一群人」。
// 篩選鈕直接寫出各群有幾個人，看到「沉睡客 23 人」自然會想去撈回來。

export default async function CustomersPage() {
  const current = await getCurrentTenant()
  if (!current) return null
  const { tenant } = current

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('customers')
    .select(
      `id, name, phone, line_user_id, visit_count, total_spent, no_show_points,
       is_blocked, is_exempt, first_visit_at, last_visit_at, created_at`
    )
    .eq('tenant_id', tenant.id)
    .order('last_visit_at', { ascending: false, nullsFirst: false })

  return (
    <CustomerList
      customers={(data ?? []) as CustomerRow[]}
      timezone={tenant.timezone}
      loadError={error?.message ?? null}
    />
  )
}
