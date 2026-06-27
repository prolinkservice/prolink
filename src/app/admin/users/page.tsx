import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { parseCity } from '@/lib/address'
import { UserListClient, type UserRow } from './UserListClient'

function calcAge(birthdate: string) {
  const today = new Date()
  const d = new Date(birthdate)
  let age = today.getFullYear() - d.getFullYear()
  const monthDiff = today.getMonth() - d.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) age--
  return age
}

const GENDER_LABEL: Record<string, string> = {
  male: '男性',
  female: '女性',
  other: '其他',
}

export default async function AdminUsersPage() {
  const supabase = await createServerSupabaseClient()
  const admin = createAdminSupabaseClient()

  const [{ data: profiles }, { data: practitioners }, { data: bookings }, { data: authUsers }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, role, gender, birthdate, created_at'),
    supabase.from('practitioners').select('user_id, shop_address, status'),
    supabase
      .from('bookings')
      .select('customer_id, customer_address, practitioners ( shop_address )'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const emailById = new Map<string, string>()
  for (const u of authUsers?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email)
  }

  const practitionerByUserId = new Map<string, { shop_address: string | null; status: string }>()
  for (const p of practitioners ?? []) {
    if (p.user_id) practitionerByUserId.set(p.user_id, { shop_address: p.shop_address, status: p.status })
  }

  // 依預約紀錄推估每位客人最常出現的地區
  const cityCountByCustomer = new Map<string, Map<string, number>>()
  for (const b of bookings ?? []) {
    const practitionerRaw = b.practitioners as unknown
    const practitioner = Array.isArray(practitionerRaw) ? practitionerRaw[0] : practitionerRaw
    const shopAddress = (practitioner as { shop_address?: string } | null)?.shop_address
    const city = parseCity(b.customer_address) ?? parseCity(shopAddress)
    if (!city) continue
    const map = cityCountByCustomer.get(b.customer_id) ?? new Map<string, number>()
    map.set(city, (map.get(city) ?? 0) + 1)
    cityCountByCustomer.set(b.customer_id, map)
  }
  function topCity(customerId: string): string | null {
    const map = cityCountByCustomer.get(customerId)
    if (!map || map.size === 0) return null
    return [...map.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }

  const rows: UserRow[] = (profiles ?? []).map((p) => {
    const practitionerInfo = practitionerByUserId.get(p.id)
    const region = practitionerInfo
      ? parseCity(practitionerInfo.shop_address)
      : topCity(p.id)

    return {
      id: p.id,
      name: p.display_name ?? '（未設定姓名）',
      email: emailById.get(p.id) ?? '-',
      role: p.role,
      practitionerStatus: practitionerInfo?.status ?? null,
      gender: p.gender ? GENDER_LABEL[p.gender] ?? p.gender : null,
      age: p.birthdate ? calcAge(p.birthdate) : null,
      region,
      createdAt: p.created_at,
    }
  })

  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="space-y-4">
      <h1 className="font-bold text-xl text-foreground">會員管理</h1>
      <UserListClient rows={rows} />
    </div>
  )
}
