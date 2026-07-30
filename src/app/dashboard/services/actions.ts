'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentTenant } from '@/lib/tenant'
import { derivePriceUnit, type ServiceDraft } from '@/lib/catalog'

// Server Function 可以被直接 POST 呼叫，不是只有走 UI，
// 所以每一支都要自己確認登入與租戶歸屬

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function saveService(draft: ServiceDraft): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }
  const { tenant } = current

  const name = draft.name.trim()
  if (!name) return { ok: false, error: '請填服務名稱' }

  const capacity = Math.max(1, Math.floor(draft.capacity || 1))
  const durationMode = draft.duration_mode === 'hourly' ? 'hourly' : 'fixed'

  let durationMin: number | null = null
  let minHours: number | null = null
  let maxHours: number | null = null

  if (durationMode === 'fixed') {
    durationMin = Math.floor(draft.duration_min ?? 0)
    if (durationMin <= 0) return { ok: false, error: '請填服務時長' }
  } else {
    minHours = draft.min_hours ?? 1
    maxHours = draft.max_hours ?? null
    if (minHours <= 0) return { ok: false, error: '最少時數要大於 0' }
    if (maxHours !== null && maxHours < minHours) {
      return { ok: false, error: '最多時數不能小於最少時數' }
    }
  }

  // 定金：不收與全額預收都不需要 deposit_type / deposit_value
  const paymentMode = draft.payment_mode
  let depositType = draft.deposit_type
  let depositValue = draft.deposit_value
  if (paymentMode !== 'deposit') {
    depositType = 'none'
    depositValue = null
  } else {
    if (depositType === 'none') depositType = 'fixed'
    if (!depositValue || depositValue <= 0) {
      return { ok: false, error: '請填定金金額或百分比' }
    }
    if (depositType === 'percent' && depositValue > 100) {
      return { ok: false, error: '定金百分比不能超過 100' }
    }
  }

  // 沒有任何佔用資源就無法防衝堂——同一個時段會被重複約走
  const bookableIds = Array.from(new Set(draft.bookableIds))
  if (bookableIds.length === 0) {
    return {
      ok: false,
      error: '請至少選一項會被佔用的資源，系統要靠它判斷時段能不能約',
    }
  }

  const supabase = await createServerSupabaseClient()

  // 標的必須屬於自己的租戶。RLS 已經擋掉跨租戶，這裡再確認一次是為了
  // 取回 type 寫進 service_requirements
  const { data: bookableRows, error: bookableError } = await supabase
    .from('bookables')
    .select('id, type')
    .eq('tenant_id', tenant.id)
    .in('id', bookableIds)

  if (bookableError) return { ok: false, error: bookableError.message }
  if (!bookableRows || bookableRows.length !== bookableIds.length) {
    return { ok: false, error: '有選到不存在的資源，請重新整理再試' }
  }

  // 固定據點只在「固定店面」模式下有意義
  let locationId = draft.location_mode === 'fixed' ? draft.location_id : null
  if (locationId) {
    const { data: loc } = await supabase
      .from('locations')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('id', locationId)
      .maybeSingle()
    if (!loc) locationId = null
  }

  const serviceArea =
    draft.location_mode === 'mobile' && draft.service_area?.length
      ? draft.service_area
      : null

  const payload = {
    tenant_id: tenant.id,
    name,
    category: draft.category?.trim() || null,
    duration_mode: durationMode,
    duration_min: durationMin,
    min_hours: minHours,
    max_hours: maxHours,
    buffer_before_min: Math.max(0, Math.floor(draft.buffer_before_min || 0)),
    buffer_after_min: Math.max(0, Math.floor(draft.buffer_after_min || 0)),
    price: Math.max(0, draft.price || 0),
    price_unit: derivePriceUnit({ duration_mode: durationMode, capacity }),
    location_mode: draft.location_mode,
    location_id: locationId,
    service_area: serviceArea,
    payment_mode: paymentMode,
    deposit_type: depositType,
    deposit_value: depositValue,
    capacity,
    min_headcount: capacity > 1 ? (draft.min_headcount ?? null) : null,
    is_active: draft.is_active,
  }

  let serviceId = draft.id

  if (serviceId) {
    const { error } = await supabase
      .from('services')
      .update(payload)
      .eq('id', serviceId)
      .eq('tenant_id', tenant.id)
    if (error) return { ok: false, error: error.message }
  } else {
    // 新服務排在最後面，老師排好的順序不會被打亂
    const { data: last } = await supabase
      .from('services')
      .select('sort_order')
      .eq('tenant_id', tenant.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: inserted, error } = await supabase
      .from('services')
      .insert({ ...payload, sort_order: (last?.sort_order ?? 0) + 1 })
      .select('id')
      .single()
    if (error) return { ok: false, error: error.message }
    serviceId = inserted.id
  }

  // 需求整組換掉。逐筆比對省下的那幾個 query 不值得多出來的錯誤空間
  const { error: clearError } = await supabase
    .from('service_requirements')
    .delete()
    .eq('service_id', serviceId)
  if (clearError) return { ok: false, error: clearError.message }

  const { error: reqError } = await supabase.from('service_requirements').insert(
    bookableRows.map((b) => ({
      service_id: serviceId,
      bookable_type: b.type,
      bookable_id: b.id,
      quantity: 1,
    }))
  )
  if (reqError) return { ok: false, error: reqError.message }

  revalidatePath('/dashboard/services')
  revalidatePath(`/p/${tenant.slug}`)
  return { ok: true }
}

export async function deleteService(id: string): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }
  const { tenant } = current

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenant.id)

  if (error) {
    // bookings.service_id 是 on delete restrict：有預約紀錄就不能刪，
    // 否則歷史預約會查不到當初做了什麼
    if (error.code === '23503') {
      return {
        ok: false,
        error: '這項服務已經有預約紀錄，不能刪除。改成關閉線上預約就好。',
      }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath('/dashboard/services')
  revalidatePath(`/p/${tenant.slug}`)
  return { ok: true }
}
