'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentTenant } from '@/lib/tenant'
import { fetchAvailableSlots, type AvailableSlot } from '@/lib/availability'
import type { PaymentMethod } from '@/lib/bookings'
import { notifyTenantCancelled } from '@/lib/line/notify'

export type ActionResult = { ok: true } | { ok: false; error: string }

export type CustomerHit = {
  id: string
  name: string
  phone: string | null
  visit_count: number
  no_show_points: number
  is_blocked: boolean
}

/** 手動建單第一步：打手機或名字找既有客人 */
export async function searchCustomers(query: string): Promise<CustomerHit[]> {
  const current = await getCurrentTenant()
  if (!current) return []

  const q = query.trim()
  if (q.length < 2) return []

  const digits = q.replace(/\D/g, '')
  const supabase = await createServerSupabaseClient()
  const filter =
    digits.length >= 2
      ? `phone.ilike.%${digits}%,name.ilike.%${q}%`
      : `name.ilike.%${q}%`

  const { data } = await supabase
    .from('customers')
    .select('id, name, phone, visit_count, no_show_points, is_blocked')
    .eq('tenant_id', current.tenant.id)
    .or(filter)
    .order('last_visit_at', { ascending: false, nullsFirst: false })
    .limit(8)

  return (data ?? []) as CustomerHit[]
}

/** 手動建單時列出「引擎認為可以約」的時段，方便老師直接點 */
export async function manualSlots(input: {
  serviceId: string
  date: string
  durationMin?: number | null
}): Promise<AvailableSlot[]> {
  const current = await getCurrentTenant()
  if (!current) return []

  return fetchAvailableSlots({
    tenantId: current.tenant.id,
    serviceId: input.serviceId,
    date: input.date,
    durationMin: input.durationMin ?? null,
  })
}

export type CreateBookingInput = {
  serviceId: string
  /** ISO 字串。老師可以填任意時間，不受 30 分鐘格點限制 */
  startAt: string
  customerId?: string | null
  name?: string
  phone?: string
  bookableIds?: string[] | null
  locationId?: string | null
  durationMin?: number | null
  /** 到府服務才有：客人家的地址 */
  serviceAddress?: string
  note?: string
  internalNote?: string
}

export async function createManualBooking(
  input: CreateBookingInput
): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }

  const supabase = await createServerSupabaseClient()

  // 建單走 security definer 函式，RLS 不會替我們把關地點的歸屬，
  // 所以在這裡確認一次：這個據點必須是自己的
  let locationId = input.locationId ?? null
  if (locationId) {
    const { data: location } = await supabase
      .from('locations')
      .select('id')
      .eq('tenant_id', current.tenant.id)
      .eq('id', locationId)
      .maybeSingle()
    if (!location) locationId = null
  }

  const { data, error } = await supabase.rpc('create_manual_booking', {
    p_tenant_id: current.tenant.id,
    p_service_id: input.serviceId,
    p_start_at: input.startAt,
    p_customer_id: input.customerId ?? null,
    p_name: input.name ?? null,
    p_phone: input.phone ?? null,
    p_bookable_ids: input.bookableIds ?? null,
    p_location_id: locationId,
    p_duration_min: input.durationMin ?? null,
    p_note: input.note ?? null,
    p_internal_note: input.internalNote ?? null,
  })

  if (error) {
    // 23P01 是互斥約束：同一個人或同一間包廂被排了兩筆。
    // 這條是硬擋——移動時間不足可以強制建立，時間重疊不行
    if (error.code === '23P01') {
      return { ok: false, error: '這個時段已經被佔用了，同一個人或場地不能排兩筆' }
    }
    if (error.code?.startsWith('P0')) return { ok: false, error: error.message }
    console.error('[create_manual_booking] 建立失敗', {
      code: error.code,
      message: error.message,
    })
    return { ok: false, error: '建立失敗，請稍後再試' }
  }

  // 到府地址補在建立之後，而不是塞進函式再多一個參數：
  // 改函式簽名要再跑一次 migration，而這只是一個備註性質的欄位，
  // 寫失敗也不會讓預約本身出問題（RLS 仍然只讓自己的租戶改得動）
  const address = input.serviceAddress?.trim()
  const created = (Array.isArray(data) ? data[0] : data) as { booking_id?: string } | null
  if (address && created?.booking_id) {
    const { error: addressError } = await supabase
      .from('bookings')
      .update({ service_address: address })
      .eq('id', created.booking_id)
      .eq('tenant_id', current.tenant.id)
    if (addressError) {
      console.error('[create_manual_booking] 地址沒存進去', {
        bookingId: created.booking_id,
        message: addressError.message,
      })
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/calendar')
  return { ok: true }
}

/**
 * 取消一筆還沒發生的預約（草稿：line-notifications.html §5）。
 *
 * 跟「待結案」的三選一是兩回事：那是時間過了才用的，這是還沒發生就不做了，
 * 時段要放回去讓別人約得到。
 *
 * 原因只留在後台。發給客人的一律是制式道歉文案——職人填的很可能是
 * 內部備註，不該直接送到客人眼前（2026-08-02 定案）。
 */
export async function cancelBooking(input: {
  bookingId: string
  reason?: string
  /** 有綁 LINE 的客人才問得到這一題。職人可以自己打電話講就好 */
  notifyCustomer: boolean
}): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('cancel_booking', {
    p_booking_id: input.bookingId,
    p_actor: 'tenant',
    p_reason: input.reason ?? null,
    p_line_user_id: null,
  })

  if (error) {
    if (error.code?.startsWith('P0')) return { ok: false, error: error.message }
    console.error('[cancel_booking] 取消失敗', { code: error.code, message: error.message })
    return { ok: false, error: '取消失敗，請稍後再試' }
  }

  // 預約已經取消了，通知發不出去不該讓職人以為沒取消成功
  if (input.notifyCustomer) {
    try {
      await notifyTenantCancelled(input.bookingId)
    } catch (notifyError) {
      console.error('[cancel_booking] 取消通知沒發出去', {
        bookingId: input.bookingId,
        notifyError,
      })
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/calendar')
  return { ok: true }
}

export async function closeBooking(input: {
  bookingId: string
  outcome: 'completed' | 'no_show' | 'cancelled'
  actualAmount?: number | null
  paymentMethod?: PaymentMethod | null
  internalNote?: string
}): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('close_booking', {
    p_booking_id: input.bookingId,
    p_outcome: input.outcome,
    p_actual_amount: input.actualAmount ?? null,
    p_payment_method: input.paymentMethod ?? null,
    p_internal_note: input.internalNote ?? null,
  })

  if (error) {
    if (error.code?.startsWith('P0')) return { ok: false, error: error.message }
    console.error('[close_booking] 結案失敗', { code: error.code, message: error.message })
    return { ok: false, error: '結案失敗，請稍後再試' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/calendar')
  return { ok: true }
}
