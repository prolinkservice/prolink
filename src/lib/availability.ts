import { createServerSupabaseClient } from '@/lib/supabase-server'

// 可預約時段一律由資料庫的 available_slots 算（見
// supabase/migrations/20260730000002_available_slots.sql）。
//
// 為什麼不在 Node 這一層算：算空檔要同時看排班、既有預約、緩衝與
// 移動時間，全部撈回來再比對，既慢又會把「誰幾點來過」洩漏到前端。
// 放在 security definer 函式裡，回傳的只有時間。

export type AvailableSlot = {
  start_at: string
  end_at: string
  location_id: string | null
  bookable_ids: string[]
}

export type SlotQuery = {
  tenantId: string
  serviceId: string
  /** 客人選的日期，YYYY-MM-DD（租戶所在時區的那一天） */
  date: string
  locationId?: string | null
  /** 場租由客人選時數時填，固定時長的服務不用 */
  durationMin?: number | null
}

export async function fetchAvailableSlots(q: SlotQuery): Promise<AvailableSlot[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('available_slots', {
    p_tenant_id: q.tenantId,
    p_service_id: q.serviceId,
    p_date: q.date,
    p_location_id: q.locationId ?? null,
    p_duration_min: q.durationMin ?? null,
  })

  if (error) {
    console.error('[available_slots] 算不出時段', {
      tenantId: q.tenantId,
      serviceId: q.serviceId,
      date: q.date,
      code: error.code,
      message: error.message,
      hint: error.hint,
    })
    return []
  }

  return (data ?? []) as AvailableSlot[]
}

// 時區相關的工具在 @/lib/datetime，兩邊都要用，不在這裡再寫一份
