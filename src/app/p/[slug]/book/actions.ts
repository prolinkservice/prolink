'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { lookupTenantBySlug } from '@/lib/tenant'
import { fetchAvailableSlots, type AvailableSlot } from '@/lib/availability'

// 客人是匿名的，這兩支都不能相信前端傳來的租戶身分——
// 一律用網址上的 slug 重新查一次。

/** 那天沒空檔時，往後找幾天就好。找太遠會讓函式跑很久，也沒人想約兩週後 */
const LOOK_AHEAD_DAYS = 14

export type SlotsResult = {
  slots: AvailableSlot[]
  /** 當天沒空檔時，最近一個約得到的日期 */
  nextDate: string | null
}

export async function loadSlots(input: {
  slug: string
  serviceId: string
  date: string
  durationMin?: number | null
}): Promise<SlotsResult> {
  const found = await lookupTenantBySlug(input.slug)
  if (found.kind !== 'found') return { slots: [], nextDate: null }

  const slots = await fetchAvailableSlots({
    tenantId: found.tenant.id,
    serviceId: input.serviceId,
    date: input.date,
    durationMin: input.durationMin ?? null,
  })

  if (slots.length > 0) return { slots, nextDate: null }

  for (let i = 1; i <= LOOK_AHEAD_DAYS; i++) {
    const probe = addDays(input.date, i)
    const ahead = await fetchAvailableSlots({
      tenantId: found.tenant.id,
      serviceId: input.serviceId,
      date: probe,
      durationMin: input.durationMin ?? null,
    })
    if (ahead.length > 0) return { slots: [], nextDate: probe }
  }

  return { slots: [], nextDate: null }
}

export type SubmitResult =
  | { ok: true; code: string; status: 'confirmed' | 'pending' }
  | { ok: false; error: string; retry: boolean }

export async function submitBooking(input: {
  slug: string
  serviceId: string
  startAt: string
  bookableIds: string[]
  locationId: string | null
  durationMin?: number | null
  name: string
  phone: string
  note?: string
  serviceAddress?: string
}): Promise<SubmitResult> {
  const found = await lookupTenantBySlug(input.slug)
  if (found.kind !== 'found') {
    return { ok: false, error: '找不到這家店', retry: false }
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('create_booking', {
    p_tenant_id: found.tenant.id,
    p_service_id: input.serviceId,
    p_start_at: input.startAt,
    p_bookable_ids: input.bookableIds,
    p_name: input.name,
    p_phone: input.phone,
    p_location_id: input.locationId,
    p_duration_min: input.durationMin ?? null,
    p_note: input.note ?? null,
    p_service_address: input.serviceAddress ?? null,
    p_line_user_id: null,
  })

  if (error) {
    // P0409 是函式自己丟的「時段沒了」，23P01 是資料庫的互斥約束擋下來的
    // 競態——兩個人同一秒送出，後到的那位會落在這裡
    if (error.code === 'P0409' || error.code === '23P01') {
      return { ok: false, error: '這個時段剛剛被約走了', retry: true }
    }
    // P0403 的訊息是職人自己設定的封鎖文案，原樣顯示，不加油添醋
    if (error.code === 'P0403') {
      return { ok: false, error: error.message, retry: false }
    }
    if (error.code === 'P0400' || error.code === 'P0404') {
      return { ok: false, error: error.message, retry: false }
    }
    console.error('[create_booking] 建立預約失敗', {
      slug: input.slug,
      code: error.code,
      message: error.message,
    })
    return { ok: false, error: '送出失敗，請稍後再試一次', retry: true }
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { code: string; status: 'confirmed' | 'pending' }
    | undefined

  if (!row) return { ok: false, error: '送出失敗，請稍後再試一次', retry: true }
  return { ok: true, code: row.code, status: row.status }
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + days))
  return next.toISOString().slice(0, 10)
}
