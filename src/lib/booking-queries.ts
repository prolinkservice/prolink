import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { BookingRow } from '@/lib/bookings'

// 預約的讀取集中在這裡：今日行程與行事曆看的是同一份資料，
// 欄位一改兩邊就一起改，不會漏掉其中一邊。

const BOOKING_FIELDS = `
  id, kind, start_at, end_at, status, source,
  quoted_price, actual_amount, payment_method, note, internal_note,
  service_address,
  location_id, service_id, customer_id,
  locations(name),
  services(name),
  customers(name, phone, no_show_points, visit_count)
`

type Joined<T> = T | T[] | null

type BookingQueryRow = {
  id: string
  kind: 'booking' | 'block'
  start_at: string
  end_at: string
  status: BookingRow['status']
  source: BookingRow['source']
  quoted_price: number | null
  actual_amount: number | null
  payment_method: BookingRow['payment_method']
  note: string | null
  internal_note: string | null
  service_address: string | null
  location_id: string | null
  service_id: string | null
  customer_id: string | null
  locations: Joined<{ name: string }>
  services: Joined<{ name: string }>
  customers: Joined<{
    name: string
    phone: string | null
    no_show_points: number
    visit_count: number
  }>
}

// supabase-js 對單筆關聯有時回物件、有時回陣列，兩種都吃
function one<T>(value: Joined<T>): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function fetchBookings(input: {
  tenantId: string
  from: Date
  to: Date
}): Promise<BookingRow[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_FIELDS)
    .eq('tenant_id', input.tenantId)
    .gte('start_at', input.from.toISOString())
    .lt('start_at', input.to.toISOString())
    .order('start_at', { ascending: true })

  if (error) {
    console.error('[fetchBookings] 讀不到預約', {
      tenantId: input.tenantId,
      code: error.code,
      message: error.message,
    })
    return []
  }

  return ((data ?? []) as unknown as BookingQueryRow[]).map((row) => {
    const customer = one(row.customers)
    return {
      id: row.id,
      kind: row.kind,
      start_at: row.start_at,
      end_at: row.end_at,
      status: row.status,
      source: row.source,
      quoted_price: row.quoted_price,
      actual_amount: row.actual_amount,
      payment_method: row.payment_method,
      note: row.note,
      internal_note: row.internal_note,
      location_id: row.location_id,
      location_name: one(row.locations)?.name ?? null,
      service_address: row.service_address,
      service_id: row.service_id,
      service_name: one(row.services)?.name ?? null,
      customer_id: row.customer_id,
      customer_name: customer?.name ?? null,
      customer_phone: customer?.phone ?? null,
      customer_no_show_points: Number(customer?.no_show_points ?? 0),
      customer_visit_count: Number(customer?.visit_count ?? 0),
    }
  })
}
