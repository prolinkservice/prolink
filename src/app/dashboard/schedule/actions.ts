'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { getCurrentTenant } from '@/lib/tenant'
import type { BookableType, DaySegment, LocationType } from '@/lib/catalog'

// Server Function 可以被直接 POST 呼叫，每一支都要自己確認租戶歸屬

export type ActionResult = { ok: true } | { ok: false; error: string }

function refresh(slug: string) {
  revalidatePath('/dashboard/schedule')
  revalidatePath('/dashboard/services')
  revalidatePath(`/p/${slug}`)
}

// ── 據點 ──────────────────────────────────────────────────────

/**
 * 據點照片（草稿：docs/mockups/location-photo.html）。
 *
 * 三個決定：
 *   ① **走伺服器動作、用 service role 寫入**，而不是讓瀏覽器直接傳。
 *      這樣不必替 storage.objects 另外開政策，也不會有「換一張之後
 *      舊檔案還躺在別人的資料夾裡」這種只靠前端把關的漏洞。
 *   ② 檔名固定成據點 id，換照片直接覆蓋，不會愈積愈多。
 *   ③ 網址後面掛時間戳，不然職人換了照片自己還看到舊的（CDN 快取）。
 *
 * 壓縮在瀏覽器做完才送上來——伺服器動作的請求有大小限制，
 * 手機直出的 4MB 原圖會直接被擋掉。
 */
export async function saveLocationPhoto(input: {
  locationId: string
  /** 已經壓好的 JPEG，base64（不含 data: 前綴） */
  base64: string
}): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }
  const { tenant } = current

  const supabase = await createServerSupabaseClient()
  // 這個據點必須是自己的。等一下要用 service role 寫檔，
  // RLS 不會再替我們擋一次
  const { data: location } = await supabase
    .from('locations')
    .select('id')
    .eq('id', input.locationId)
    .eq('tenant_id', tenant.id)
    .maybeSingle()
  if (!location) return { ok: false, error: '找不到這個據點' }

  const bytes = Buffer.from(input.base64, 'base64')
  if (bytes.length === 0) return { ok: false, error: '照片是空的，請重選一張' }
  if (bytes.length > 3 * 1024 * 1024) {
    return { ok: false, error: '照片太大了，請換一張' }
  }

  const admin = createAdminSupabaseClient()
  const path = `${tenant.id}/${input.locationId}.jpg`
  const { error: uploadError } = await admin.storage
    .from('location-photos')
    .upload(path, bytes, { upsert: true, contentType: 'image/jpeg' })

  if (uploadError) {
    console.error('[location-photo] 上傳失敗', {
      locationId: input.locationId,
      message: uploadError.message,
    })
    return { ok: false, error: '上傳失敗，請再試一次' }
  }

  const { data: pub } = admin.storage.from('location-photos').getPublicUrl(path)
  const url = `${pub.publicUrl}?v=${Date.now()}`

  const { error } = await supabase
    .from('locations')
    .update({ photo_url: url })
    .eq('id', input.locationId)
    .eq('tenant_id', tenant.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/dashboard/schedule')
  revalidatePath(`/p/${tenant.slug}`)
  return { ok: true }
}

export async function removeLocationPhoto(locationId: string): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }
  const { tenant } = current

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('locations')
    .update({ photo_url: null })
    .eq('id', locationId)
    .eq('tenant_id', tenant.id)
  if (error) return { ok: false, error: error.message }

  // 檔案本身留著。移除只是不再顯示，職人反悔時重傳一次就好，
  // 而且刪檔失敗不該讓「拿掉照片」這個動作看起來失敗
  await createAdminSupabaseClient()
    .storage.from('location-photos')
    .remove([`${tenant.id}/${locationId}.jpg`])

  revalidatePath('/dashboard/schedule')
  revalidatePath(`/p/${tenant.slug}`)
  return { ok: true }
}

export async function saveLocation(input: {
  id?: string
  name: string
  address: string | null
  type: LocationType
}): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }
  const { tenant } = current

  const name = input.name.trim()
  if (!name) return { ok: false, error: '請填據點名稱' }

  const supabase = await createServerSupabaseClient()
  const payload = {
    name,
    address: input.address?.trim() || null,
    type: input.type,
  }

  if (input.id) {
    const { error } = await supabase
      .from('locations')
      .update(payload)
      .eq('id', input.id)
      .eq('tenant_id', tenant.id)
    if (error) return { ok: false, error: error.message }
  } else {
    const { data: last } = await supabase
      .from('locations')
      .select('sort_order')
      .eq('tenant_id', tenant.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { error } = await supabase.from('locations').insert({
      ...payload,
      tenant_id: tenant.id,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    if (error) return { ok: false, error: error.message }
  }

  refresh(tenant.slug)
  return { ok: true }
}

/**
 * 停用而不是刪除。business_hours.location_id 是 on delete cascade，
 * 真的刪掉會把整份排班一起帶走；而且老師哪天又開回來，設定還在。
 * （progressive-settings.html 原則 3）
 */
export async function setLocationActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }
  const { tenant } = current

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('locations')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('tenant_id', tenant.id)
  if (error) return { ok: false, error: error.message }

  refresh(tenant.slug)
  return { ok: true }
}

// ── 可預約標的 ────────────────────────────────────────────────

export async function saveBookable(input: {
  id?: string
  type: BookableType
  name: string
  locationId: string | null
  capacity: number
  hourlyPrice: number | null
}): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }
  const { tenant } = current

  const name = input.name.trim()
  if (!name) return { ok: false, error: '請填名稱' }

  const supabase = await createServerSupabaseClient()
  const payload = {
    name,
    location_id: input.locationId,
    capacity: Math.max(1, Math.floor(input.capacity || 1)),
    hourly_price: input.type === 'space' ? input.hourlyPrice : null,
  }

  if (input.id) {
    // type 與 member_id 有 check 約束綁在一起，改名不動這兩欄
    const { error } = await supabase
      .from('bookables')
      .update(payload)
      .eq('id', input.id)
      .eq('tenant_id', tenant.id)
    if (error) return { ok: false, error: error.message }
  } else {
    if (input.type === 'staff') {
      // staff 標的必須綁 tenant_members，要從成員管理新增
      return { ok: false, error: '要新增服務人員，請到成員管理邀請' }
    }
    const { data: last } = await supabase
      .from('bookables')
      .select('sort_order')
      .eq('tenant_id', tenant.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { error } = await supabase.from('bookables').insert({
      ...payload,
      tenant_id: tenant.id,
      type: input.type,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    if (error) return { ok: false, error: error.message }
  }

  refresh(tenant.slug)
  return { ok: true }
}

/** 同樣只停用不刪除：booking_bookables 有既有預約會擋住刪除 */
export async function setBookableActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }
  const { tenant } = current

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('bookables')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('tenant_id', tenant.id)
  if (error) return { ok: false, error: error.message }

  refresh(tenant.slug)
  return { ok: true }
}

/** 跨點移動與到府移動的預留時間，設在標的上（規格 §8.3） */
export async function saveBookableTravel(input: {
  bookableId: string
  crossSiteTravelMin: number
  defaultTravelMin: number
}): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }
  const { tenant } = current

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('bookables')
    .update({
      cross_site_travel_min: Math.max(0, Math.floor(input.crossSiteTravelMin || 0)),
      default_travel_min: Math.max(0, Math.floor(input.defaultTravelMin || 0)),
    })
    .eq('id', input.bookableId)
    .eq('tenant_id', tenant.id)
  if (error) return { ok: false, error: error.message }

  refresh(tenant.slug)
  return { ok: true }
}

// ── 每週排班 ──────────────────────────────────────────────────

/**
 * 一次換掉某個標的某一天的所有時段。
 * 一天可以有多段、各綁各的地點，時間允許重疊（規格 §8.5）。
 */
export async function saveDaySegments(input: {
  bookableId: string
  weekday: number
  segments: DaySegment[]
}): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }
  const { tenant } = current

  if (input.weekday < 0 || input.weekday > 6) {
    return { ok: false, error: '星期不正確' }
  }

  for (const seg of input.segments) {
    if (!seg.start || !seg.end) return { ok: false, error: '請填開始與結束時間' }
    if (seg.end <= seg.start) return { ok: false, error: '結束時間要晚於開始時間' }
  }

  const supabase = await createServerSupabaseClient()

  // 標的歸屬自己確認一次，不倚賴前端傳來的 id
  const { data: bookable } = await supabase
    .from('bookables')
    .select('id')
    .eq('id', input.bookableId)
    .eq('tenant_id', tenant.id)
    .maybeSingle()
  if (!bookable) return { ok: false, error: '找不到這個資源' }

  const { error: clearError } = await supabase
    .from('business_hours')
    .delete()
    .eq('tenant_id', tenant.id)
    .eq('bookable_id', input.bookableId)
    .eq('weekday', input.weekday)
  if (clearError) return { ok: false, error: clearError.message }

  if (input.segments.length > 0) {
    const { error } = await supabase.from('business_hours').insert(
      input.segments.map((seg) => ({
        tenant_id: tenant.id,
        bookable_id: input.bookableId,
        location_id: seg.locationId,
        weekday: input.weekday,
        start_time: seg.start,
        end_time: seg.end,
      }))
    )
    if (error) return { ok: false, error: error.message }
  }

  refresh(tenant.slug)
  return { ok: true }
}

/** 把某一天的班複製到其他幾天，省下重複填七次 */
export async function copyDayTo(input: {
  bookableId: string
  fromWeekday: number
  toWeekdays: number[]
}): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }
  const { tenant } = current

  const supabase = await createServerSupabaseClient()
  const { data: source, error: readError } = await supabase
    .from('business_hours')
    .select('location_id, start_time, end_time')
    .eq('tenant_id', tenant.id)
    .eq('bookable_id', input.bookableId)
    .eq('weekday', input.fromWeekday)
  if (readError) return { ok: false, error: readError.message }

  const targets = input.toWeekdays.filter((d) => d >= 0 && d <= 6 && d !== input.fromWeekday)
  if (targets.length === 0) return { ok: false, error: '請選要複製到哪幾天' }

  const { error: clearError } = await supabase
    .from('business_hours')
    .delete()
    .eq('tenant_id', tenant.id)
    .eq('bookable_id', input.bookableId)
    .in('weekday', targets)
  if (clearError) return { ok: false, error: clearError.message }

  if (source && source.length > 0) {
    const rows = targets.flatMap((weekday) =>
      source.map((seg) => ({
        tenant_id: tenant.id,
        bookable_id: input.bookableId,
        location_id: seg.location_id,
        weekday,
        start_time: seg.start_time,
        end_time: seg.end_time,
      }))
    )
    const { error } = await supabase.from('business_hours').insert(rows)
    if (error) return { ok: false, error: error.message }
  }

  refresh(tenant.slug)
  return { ok: true }
}

// ── 據點之間的移動時間 ────────────────────────────────────────

export async function saveTravelTimes(
  entries: { fromLocationId: string; toLocationId: string; minutes: number }[]
): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }
  const { tenant } = current

  const clean = entries.filter(
    (e) => e.fromLocationId !== e.toLocationId && Number.isFinite(e.minutes) && e.minutes >= 0
  )
  if (clean.length === 0) return { ok: true }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('location_travel_times').upsert(
    clean.map((e) => ({
      tenant_id: tenant.id,
      from_location_id: e.fromLocationId,
      to_location_id: e.toLocationId,
      minutes: Math.floor(e.minutes),
    })),
    { onConflict: 'tenant_id,from_location_id,to_location_id' }
  )
  if (error) return { ok: false, error: error.message }

  refresh(tenant.slug)
  return { ok: true }
}
