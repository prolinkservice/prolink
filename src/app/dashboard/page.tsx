import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentTenant } from '@/lib/tenant'
import { fetchBookings } from '@/lib/booking-queries'
import { needsClosing } from '@/lib/bookings'
import { todayIn, zonedDayRange } from '@/lib/datetime'
import { TodayBoard, type LocationInfo } from './TodayBoard'
import type { ServiceOption } from './NewBookingSheet'

export const metadata: Metadata = { title: '今日行程 · 職人連結' }

// 今日行程。草稿：docs/mockups/dashboard.html §01

/** 待結案往回看幾天。再久以前的要到報表頁處理，不要把首頁塞爆 */
const CLOSE_LOOKBACK_DAYS = 14

export default async function TodayPage() {
  const current = await getCurrentTenant()
  if (!current) return null
  const { tenant } = current

  const today = todayIn(tenant.timezone)
  const { start, end } = zonedDayRange(today, tenant.timezone)

  const supabase = await createServerSupabaseClient()
  const [todayBookings, olderBookings, servicesRes, locationsRes, travelRes, settingsRes] =
    await Promise.all([
      fetchBookings({ tenantId: tenant.id, from: start, to: end }),
      fetchBookings({
        tenantId: tenant.id,
        from: new Date(start.getTime() - CLOSE_LOOKBACK_DAYS * 86400000),
        to: start,
      }),
      supabase
        .from('services')
        .select('id, name, duration_mode, duration_min, min_hours, price, location_id, location_mode')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('locations')
        .select('id, name, address')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('location_travel_times')
        .select('from_location_id, to_location_id, minutes')
        .eq('tenant_id', tenant.id),
      supabase
        .from('tenant_settings')
        .select('refundable_hours')
        .eq('tenant_id', tenant.id)
        .maybeSingle(),
    ])

  const pendingClose = olderBookings.filter((b) => needsClosing(b))

  const travel = Object.fromEntries(
    (travelRes.data ?? []).map((t) => [
      `${t.from_location_id}|${t.to_location_id}`,
      t.minutes as number,
    ])
  )

  return (
    <TodayBoard
      today={todayBookings}
      pendingClose={pendingClose}
      timezone={tenant.timezone}
      todayDate={today}
      services={(servicesRes.data ?? []) as unknown as ServiceOption[]}
      locations={(locationsRes.data ?? []) as unknown as LocationInfo[]}
      travel={travel}
      refundableHours={Number(settingsRes.data?.refundable_hours ?? 48)}
    />
  )
}
