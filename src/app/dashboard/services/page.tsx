import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentTenant } from '@/lib/tenant'
import type { Bookable, Location, ServiceRow } from '@/lib/catalog'
import { ServicesManager } from './ServicesManager'

export const metadata: Metadata = { title: '服務項目 · 職人連結' }

// 服務項目。草稿：docs/mockups/settings.html §01
// 這頁最難的地方是要同時裝得下「按摩 60 分」與「場地一小時」，
// 所以時長模式一切換，畫面就跟著換一套欄位。

const SERVICE_FIELDS = `
  id, name, category, duration_mode, duration_min, min_hours, max_hours,
  buffer_before_min, buffer_after_min, price, price_unit,
  location_mode, location_id, service_area,
  payment_mode, deposit_type, deposit_value,
  capacity, min_headcount, is_active,
  service_requirements(bookable_id)
`

// sort_order 只用來排序，不必撈回來
type ServiceQueryRow = Omit<ServiceRow, 'bookableIds'> & {
  service_requirements: { bookable_id: string | null }[]
}

export default async function ServicesPage() {
  const current = await getCurrentTenant()
  if (!current) return null
  const { tenant } = current

  const supabase = await createServerSupabaseClient()
  const [servicesRes, bookablesRes, locationsRes] = await Promise.all([
    supabase
      .from('services')
      .select(SERVICE_FIELDS)
      .eq('tenant_id', tenant.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('bookables')
      .select(
        'id, type, name, location_id, capacity, is_active, hourly_price, cross_site_travel_min, default_travel_min'
      )
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('locations')
      .select('id, name, address, type, is_active')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ])

  const services: ServiceRow[] = ((servicesRes.data ?? []) as unknown as ServiceQueryRow[]).map(
    (row) => {
      const { service_requirements, ...rest } = row
      return {
        ...rest,
        bookableIds: service_requirements
          .map((r) => r.bookable_id)
          .filter((id): id is string => Boolean(id)),
      }
    }
  )

  return (
    <ServicesManager
      services={services}
      bookables={(bookablesRes.data ?? []) as Bookable[]}
      locations={(locationsRes.data ?? []) as Location[]}
      loadError={servicesRes.error?.message ?? null}
    />
  )
}
