import type { SupabaseClient } from '@supabase/supabase-js'

// 判斷這個客人對這位老師來說是不是新客人：只要曾經在這位老師底下有過一筆非取消的預約，就算老客人，
// 不受100人新客上限影響（新舊客人的判斷是「客人 × 老師」這個組合，不是全平台共用一份名單）
export async function isNewCustomerForPractitioner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  practitionerId: string,
  customerId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('bookings')
    .select('id')
    .eq('practitioner_id', practitionerId)
    .eq('customer_id', customerId)
    .neq('status', 'cancelled')
    .limit(1)
    .maybeSingle()
  return !data
}

// 該老師目前的不重複客人數（取消的預約不算），不額外存欄位，即時查詢避免跟實際資料兜不起來
export async function getPractitionerCustomerCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  practitionerId: string
): Promise<number> {
  const { data } = await supabase
    .from('bookings')
    .select('customer_id')
    .eq('practitioner_id', practitionerId)
    .neq('status', 'cancelled')
  const unique = new Set((data ?? []).map((b) => b.customer_id))
  return unique.size
}

export async function hasActiveSubscription(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  practitionerId: string
): Promise<boolean> {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const todayStr = `${y}-${m}-${d}`

  const { data } = await supabase
    .from('practitioner_subscriptions')
    .select('id')
    .eq('practitioner_id', practitionerId)
    .lte('start_date', todayStr)
    .gte('end_date', todayStr)
    .limit(1)
    .maybeSingle()
  return !!data
}

export const FREE_CUSTOMER_LIMIT = 100

export type BookingEligibility = { allowed: true } | { allowed: false; reason: string }

// 建立預約前的統一檢查：特權帳號略過所有限制；老客人（已約過這位老師）不受影響；
// 新客人則看這位老師目前的不重複客人數有沒有超過免費上限，超過就要看有沒有有效訂閱
export async function checkBookingEligibility(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  practitionerId: string,
  customerId: string
): Promise<BookingEligibility> {
  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('is_privileged')
    .eq('id', practitionerId)
    .single()

  if (practitioner?.is_privileged) return { allowed: true }

  const isNew = await isNewCustomerForPractitioner(supabase, practitionerId, customerId)
  if (!isNew) return { allowed: true }

  const customerCount = await getPractitionerCustomerCount(supabase, practitionerId)
  if (customerCount < FREE_CUSTOMER_LIMIT) return { allowed: true }

  const subscribed = await hasActiveSubscription(supabase, practitionerId)
  if (subscribed) return { allowed: true }

  return { allowed: false, reason: '這位老師目前額滿，暫時無法預約新客人，可以先看看其他老師' }
}
