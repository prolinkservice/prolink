import type { Metadata } from 'next'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { lookupTenantBySlug } from '@/lib/tenant'
import { todayIn } from '@/lib/datetime'
import { loadSlots } from './actions'
import { BookingFlow, type BookingService, type DayOption } from './BookingFlow'

// 客人的預約流程。草稿：docs/mockups/public-booking.html
// 日期一律用租戶所在時區算，不能用伺服器或客人手機的時區——
// 差一天客人就約錯日子。

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ service?: string }>
}

/** 往後開放多久。太長沒人約，太短熱門的老師會不夠用 */
const OPEN_DAYS = 28

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const found = await lookupTenantBySlug(slug)
  if (found.kind !== 'found') return { title: '找不到這個頁面' }
  return { title: `預約 · ${found.tenant.name}` }
}

export default async function BookPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { service: serviceId } = await searchParams

  const found = await lookupTenantBySlug(slug)
  if (found.kind === 'moved') permanentRedirect(`/p/${found.slug}`)
  if (found.kind === 'missing') notFound()

  const { tenant } = found
  if (!serviceId) redirect(`/p/${slug}`)

  const supabase = await createServerSupabaseClient()
  const [serviceRes, locationsRes, hoursRes] = await Promise.all([
    supabase
      .from('services')
      .select(
        `id, name, duration_mode, duration_min, min_hours, max_hours,
         price, price_unit, location_mode, payment_mode`
      )
      .eq('tenant_id', tenant.id)
      .eq('id', serviceId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('locations')
      .select('id, name, address')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true),
    supabase.from('business_hours').select('weekday').eq('tenant_id', tenant.id),
  ])

  if (!serviceRes.data) redirect(`/p/${slug}`)
  const service = serviceRes.data as unknown as BookingService

  // 哪幾個星期幾有人上班。這只用來把明顯不可能的日子畫灰，
  // 真正能不能約還是要問引擎
  const openWeekdays = new Set((hoursRes.data ?? []).map((h) => h.weekday as number))

  const today = todayIn(tenant.timezone)
  const days: DayOption[] = []
  for (let i = 0; i < OPEN_DAYS; i++) {
    const date = addDays(today, i)
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
    days.push({ date, weekday, open: openWeekdays.has(weekday) })
  }

  // 第一天的時段在伺服器就算好，客人開頁不用再等一次往返
  const firstOpen = days.find((d) => d.open)?.date ?? today
  const initial = await loadSlots({
    slug,
    serviceId: service.id,
    date: firstOpen,
    durationMin:
      service.duration_mode === 'hourly'
        ? Math.round((service.min_hours ?? 1) * 60)
        : null,
  })

  const locations = Object.fromEntries(
    (locationsRes.data ?? []).map((l) => [
      l.id as string,
      { name: l.name as string, address: (l.address as string | null) ?? null },
    ])
  )

  return (
    <BookingFlow
      slug={slug}
      tenant={{
        name: tenant.name,
        timezone: tenant.timezone,
        plan: tenant.plan,
        lineFriendUrl: tenant.line_friend_url,
        contactPhone: tenant.contact_phone,
      }}
      service={service}
      locations={locations}
      days={days}
      initial={{ ...initial, date: firstOpen }}
    />
  )
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}
