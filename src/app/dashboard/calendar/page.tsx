import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentTenant } from '@/lib/tenant'
import { fetchBookings } from '@/lib/booking-queries'
import { addDays, startOfWeek, todayIn, zonedDayRange } from '@/lib/datetime'
import { WeekGrid } from './WeekGrid'
import type { LocationInfo } from '../TodayBoard'
import type { ServiceOption } from '../NewBookingSheet'

export const metadata: Metadata = { title: '行事曆 · 職人連結' }

// 行事曆週檢視。草稿：docs/mockups/dashboard.html §02
// 桌機優先：安排下週班表、看整體滿載程度用的。

type Props = { searchParams: Promise<{ week?: string }> }

export default async function CalendarPage({ searchParams }: Props) {
  const current = await getCurrentTenant()
  if (!current) return null
  const { tenant } = current

  const { week } = await searchParams
  const today = todayIn(tenant.timezone)
  const weekStart = startOfWeek(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today)
  const weekEnd = addDays(weekStart, 7)

  const { start } = zonedDayRange(weekStart, tenant.timezone)
  const { start: end } = zonedDayRange(weekEnd, tenant.timezone)

  const supabase = await createServerSupabaseClient()
  const [bookings, servicesRes, locationsRes, settingsRes] = await Promise.all([
    fetchBookings({ tenantId: tenant.id, from: start, to: end }),
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
      .from('tenant_settings')
      .select('refundable_hours')
      .eq('tenant_id', tenant.id)
      .maybeSingle(),
  ])

  return (
    <WeekGrid
      weekStart={weekStart}
      today={today}
      bookings={bookings}
      timezone={tenant.timezone}
      services={(servicesRes.data ?? []) as unknown as ServiceOption[]}
      locations={(locationsRes.data ?? []) as unknown as LocationInfo[]}
      refundableHours={Number(settingsRes.data?.refundable_hours ?? 48)}
    />
  )
}
