'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { lookupTenantBySlug } from '@/lib/tenant'
import { fetchAvailableSlots, type AvailableSlot } from '@/lib/availability'
import { readLinkToken } from '@/lib/line/linkToken'
import { notifyNewBooking } from '@/lib/line/notify'

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
  /** 加好友那則訊息帶來的綁定記號。解得開才知道要把 LINE 接給誰 */
  linkRef?: string | null
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

  // 記號解不開（過期、被改過、換過金鑰、不是這家店的）就當作沒有，
  // 照常建立預約——綁不到只是收不到通知，不該讓客人約不成
  const lineUserId = readLinkToken(input.linkRef, found.tenant.id)

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
    p_line_user_id: lineUserId,
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
    | { booking_id: string; code: string; status: 'confirmed' | 'pending' }
    | undefined

  if (!row) return { ok: false, error: '送出失敗，請稍後再試一次', retry: true }

  // 通知失敗絕不能讓客人以為沒約到——預約已經成立了，這裡只是後續。
  //
  // 回傳的狀態可能跟資料庫剛才給的不一樣：付費方案本來要請客人確認，
  // 但他沒綁 LINE 收不到那則訊息，那筆就會被改成直接成立。
  // 成功頁要顯示改過之後的狀態，不然客人會在等一則永遠不會來的訊息
  let status = row.status
  try {
    status = (await notifyNewBooking(row.booking_id)) ?? row.status
  } catch (notifyError) {
    console.error('[line] 新預約通知沒發出去', { bookingId: row.booking_id, notifyError })
  }

  return { ok: true, code: row.code, status }
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + days))
  return next.toISOString().slice(0, 10)
}
