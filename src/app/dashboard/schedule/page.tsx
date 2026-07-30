import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentTenant } from '@/lib/tenant'
import type { Bookable, BusinessHour, Location, TravelTime } from '@/lib/catalog'
import { LocationsCard } from './LocationsCard'
import { ResourcesCard } from './ResourcesCard'
import { WeeklyScheduleCard } from './WeeklyScheduleCard'
import { TravelCard } from './TravelCard'

export const metadata: Metadata = { title: '營業時間與據點 · 職人連結' }

// 草稿：docs/mockups/settings.html §02、same-day-multi-site.html
//
// 這頁的順序就是設定的順序：先有地方（據點）、才有人與場地（標的）、
// 再排班、最後才需要移動時間。後面兩張卡只在真的變複雜時才出現。

export default async function SchedulePage() {
  const current = await getCurrentTenant()
  if (!current) return null
  const { tenant } = current

  const supabase = await createServerSupabaseClient()
  const [locationsRes, bookablesRes, hoursRes, travelRes, mobileRes] = await Promise.all([
    supabase
      .from('locations')
      .select('id, name, address, type, is_active')
      .eq('tenant_id', tenant.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('bookables')
      .select(
        'id, type, name, location_id, capacity, is_active, hourly_price, cross_site_travel_min, default_travel_min'
      )
      .eq('tenant_id', tenant.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('business_hours')
      .select('id, bookable_id, location_id, weekday, start_time, end_time')
      .eq('tenant_id', tenant.id)
      .order('start_time', { ascending: true }),
    supabase
      .from('location_travel_times')
      .select('from_location_id, to_location_id, minutes')
      .eq('tenant_id', tenant.id),
    // 有沒有到府服務決定要不要顯示「每趟預留」
    supabase
      .from('services')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('location_mode', 'mobile')
      .limit(1),
  ])

  const locations = (locationsRes.data ?? []) as Location[]
  const bookables = (bookablesRes.data ?? []) as Bookable[]
  const hours = (hoursRes.data ?? []) as BusinessHour[]
  const travel = (travelRes.data ?? []) as TravelTime[]
  const hasMobileService = (mobileRes.data ?? []).length > 0

  const activeLocations = locations.filter((l) => l.is_active)
  const onsiteLocations = activeLocations.filter((l) => l.type === 'onsite')

  return (
    <main className="px-6 pt-2 pb-10">
      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-[22px] font-extrabold tracking-tight">營業時間與據點</h1>
        <p className="text-[12px] text-ink-3">設定一次，之後幾乎不用再動。</p>
      </div>

      <LocationsCard locations={locations} />

      <ResourcesCard bookables={bookables} locations={activeLocations} />

      <WeeklyScheduleCard
        bookables={bookables.filter((b) => b.is_active)}
        locations={activeLocations}
        hours={hours}
      />

      {(onsiteLocations.length >= 2 || hasMobileService) && (
        <TravelCard
          locations={onsiteLocations}
          bookables={bookables.filter((b) => b.is_active && b.type === 'staff')}
          travel={travel}
          hasMobileService={hasMobileService}
        />
      )}
    </main>
  )
}
