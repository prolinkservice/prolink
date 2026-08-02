import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { formatDateTime } from '@/lib/datetime'
import { money } from '@/lib/bookings'
import { pushMessage, type LineMessage } from './channel'
import { issueLinkToken } from './linkToken'
import {
  DEFAULT_WELCOME,
  bookingCardMessage,
  bookingConfirmedMessage,
  cancelledForCustomerMessage,
  confirmRequestMessage,
  customerCancelledForOperatorMessage,
  expiredForCustomerMessage,
  newBookingForOperatorMessage,
  type BookingBrief,
} from './messages'

// 自動通知的調度（規格 §4.3、§9）。草稿：docs/mockups/line-notifications.html
//
// 三條規矩貫穿整個檔案：
//   ① 免費方案一則都不發。平台不替免費用戶負擔 LINE 費用，
//      而「系統自己提醒」正是最有感的付費理由（規格 §1.1）
//   ② 發不出去絕不能讓預約失敗。客人已經約到了，通知只是後續
//   ③ 沒綁 LINE 的客人不能留在「待確認」——他根本收不到要確認的訊息，
//      那筆會靜靜地被釋出。這種情況直接成立

type Loaded = {
  id: string
  tenant_id: string
  start_at: string
  status: string
  quoted_price: number | null
  service_address: string | null
  tenants: { name: string; slug: string; timezone: string; plan: 'free' | 'pro' } | null
  customers: {
    id: string
    name: string
    phone: string | null
    line_user_id: string | null
    visit_count: number
  } | null
  services: { name: string } | null
  locations: { name: string; address: string | null } | null
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://prolink.tw').replace(/\/$/, '')
}

async function load(bookingId: string): Promise<Loaded | null> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `id, tenant_id, start_at, status, quoted_price, service_address,
       tenants ( name, slug, timezone, plan ),
       customers ( id, name, phone, line_user_id, visit_count ),
       services ( name ),
       locations ( name, address )`
    )
    .eq('id', bookingId)
    .maybeSingle()

  if (error) {
    console.error('[line] 讀不到預約，通知略過', { bookingId, message: error.message })
    return null
  }
  return (data as unknown as Loaded) ?? null
}

function briefOf(row: Loaded): BookingBrief {
  const tz = row.tenants?.timezone ?? 'Asia/Taipei'
  return {
    bookingId: row.id,
    serviceName: row.services?.name ?? '服務',
    when: formatDateTime(row.start_at, tz),
    locationName: row.locations?.name ?? null,
    locationAddress: row.locations?.address ?? null,
    serviceAddress: row.service_address,
    price: `NT$ ${money(row.quoted_price)}`,
  }
}

/** 職人綁在後台的 LINE 帳號可能不只一個（老闆＋助理），一律都發 */
async function operatorIds(tenantId: string): Promise<string[]> {
  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('tenant_line_operators')
    .select('line_user_id')
    .eq('tenant_id', tenantId)
  return (data ?? []).map((r) => r.line_user_id as string)
}

/** 發失敗的原因如果是「找不到這位使用者」，通常就是他把官方帳號封鎖了 */
async function markBlocked(customerId: string) {
  const supabase = createAdminSupabaseClient()
  await supabase
    .from('customers')
    .update({ line_blocked_at: new Date().toISOString() })
    .eq('id', customerId)
}

/**
 * 加好友的歡迎訊息。
 *
 * 這是整條綁定的起點：訊息裡那顆按鈕帶著加密記號，客人從它進來預約、
 * 填了手機的那一刻，系統才第一次同時知道「手機」與「LINE 代號」。
 * 沒走這條路的客人綁不到，之後所有通知都發不出去。
 *
 * 免費方案不發（2026-08-02 定案：一則都不發）。代價是他升級之後，
 * 升級前加的好友仍然沒綁——那些人要等下一次從 LINE 進來預約才會接上。
 */
export async function buildWelcome(input: {
  tenantId: string
  lineUserId: string
  /** 第一次加好友才打招呼。客人自己打「預約」時只要那張卡片 */
  withGreeting: boolean
}): Promise<LineMessage[] | null> {
  const supabase = createAdminSupabaseClient()

  const [tenantRes, settingsRes, hoursRes, locationsRes] = await Promise.all([
    supabase
      .from('tenants')
      .select('name, slug, plan, contact_phone')
      .eq('id', input.tenantId)
      .maybeSingle(),
    supabase
      .from('tenant_settings')
      .select('line_welcome_message')
      .eq('tenant_id', input.tenantId)
      .maybeSingle(),
    supabase
      .from('business_hours')
      .select('weekday, start_time, end_time')
      .eq('tenant_id', input.tenantId),
    supabase
      .from('locations')
      .select('name')
      .eq('tenant_id', input.tenantId)
      .eq('is_active', true)
      .order('sort_order'),
  ])

  const tenant = tenantRes.data
  if (!tenant || tenant.plan !== 'pro') return null

  const token = issueLinkToken({ tenantId: input.tenantId, lineUserId: input.lineUserId })
  const bookUrl = token
    ? `${siteUrl()}/p/${tenant.slug}?ref=${token}`
    : `${siteUrl()}/p/${tenant.slug}`

  const locations = (locationsRes.data ?? []).map((l) => l.name as string)

  const card = bookingCardMessage({
    tenantName: tenant.name,
    bookUrl,
    openDays: describeHours(
      (hoursRes.data ?? []) as { weekday: number; start_time: string; end_time: string }[]
    ),
    locations: locations.length ? locations.join(' · ') : null,
    phone: tenant.contact_phone ?? null,
  })

  // 打招呼只在第一次見面時說。之後客人自己打「預約」時再說一次
  // 「謝謝你加入」會很怪，直接給卡片就好
  if (!input.withGreeting) return [card]

  return [
    { type: 'text', text: settingsRes.data?.line_welcome_message?.trim() || DEFAULT_WELCOME(tenant.name) },
    card,
  ]
}

/**
 * 客人自己打「預約」時回同一張卡片。
 *
 * 這是綁定漏洞最划算的補法：早就加了好友、歡迎訊息卻早已滑不見的舊客人，
 * 只要打兩個字就拿得到帶記號的按鈕，順手就綁上了。
 * 而且回覆訊息不計免費額度，等於零成本。
 */
export function looksLikeBookingRequest(text: string): boolean {
  // 全形空白與 emoji 都可能夾在中間，先清成乾淨的字串再比對
  const t = text.replace(/[\s　]/g, '')
  if (!t || t.length > 20) return false

  // 「請問可以預約嗎？」比「預約」兩個字常見得多，所以用包含而不是相等
  if (/預約|預訂|訂位|約時間|排時間/.test(t)) return true

  // 這幾個字單獨出現才算。「約」放進包含會把「大約」「約會」一起掃進來
  return ['約', '我要約', '想約', '時段', '看時段'].includes(t)
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

/**
 * 「週一至週六 10:00–21:00」。
 *
 * 刻意只給一句概括而不是逐天列表：客人真正在意的是「大概什麼時候開」，
 * 精確到哪一天幾點能約，按下去看時段就知道了——那才是唯一可信的答案。
 */
function describeHours(
  rows: { weekday: number; start_time: string; end_time: string }[]
): string | null {
  if (rows.length === 0) return null

  const days = [...new Set(rows.map((r) => r.weekday))].sort((a, b) => a - b)
  const start = rows.map((r) => r.start_time).sort()[0]
  const end = rows.map((r) => r.end_time).sort().at(-1)!

  // 連續的星期幾縮成「一至六」，中間有斷點就逐個列
  const groups: number[][] = []
  for (const day of days) {
    const last = groups.at(-1)
    if (last && day === last.at(-1)! + 1) last.push(day)
    else groups.push([day])
  }
  const label = groups
    .map((g) => (g.length > 2 ? `${WEEKDAY[g[0]]}至${WEEKDAY[g.at(-1)!]}` : g.map((d) => WEEKDAY[d]).join('、')))
    .join('、')

  return `週${label} ${start.slice(0, 5)}–${end.slice(0, 5)}`
}

/**
 * 線上預約送出之後。
 *
 * 回傳「這筆最後是什麼狀態」，因為這裡可能把 pending 改成 confirmed：
 * 付費方案本來要請客人確認，但客人沒綁 LINE（或訊息發不出去）時，
 * 留在 pending 等於等著被自動釋出，客人卻永遠不會知道要確認。
 */
export async function notifyNewBooking(
  bookingId: string
): Promise<'confirmed' | 'pending' | null> {
  const row = await load(bookingId)
  if (!row?.tenants) return null

  // 免費方案一則都不發（規格 §4.3）。他靠後台紅點知道有新預約
  if (row.tenants.plan !== 'pro') return null

  const supabase = createAdminSupabaseClient()
  const brief = briefOf(row)
  const lineUserId = row.customers?.line_user_id ?? null
  const needsConfirm = row.status === 'pending'

  let reached = false
  if (lineUserId) {
    const message = needsConfirm
      ? confirmRequestMessage({ booking: brief, tenantName: row.tenants.name })
      : bookingConfirmedMessage({ booking: brief, tenantName: row.tenants.name })

    const res = await pushMessage({
      tenantId: row.tenant_id,
      to: lineUserId,
      messages: [message],
      type: needsConfirm ? 'booking_confirm_request' : 'booking_confirmed',
      customerId: row.customers?.id ?? null,
    })
    reached = res.ok
    if (!res.ok && row.customers?.id) await markBlocked(row.customers.id)
  }

  // ③ 收不到確認訊息的人，不能把他的預約留在待確認等著被釋出
  let finalStatus: 'confirmed' | 'pending' = needsConfirm ? 'pending' : 'confirmed'
  if (needsConfirm && !reached) {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', bookingId)
      .eq('status', 'pending')
    if (error) {
      console.error('[line] 沒綁 LINE 的預約改不成已確認', { bookingId, message: error.message })
    } else {
      finalStatus = 'confirmed'
    }
  }

  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('notify_self_on_new_booking')
    .eq('tenant_id', row.tenant_id)
    .maybeSingle()

  if (settings?.notify_self_on_new_booking === false) return finalStatus

  const dashboardUrl = `${siteUrl()}/dashboard`
  const message = newBookingForOperatorMessage({
    booking: brief,
    customerName: row.customers?.name ?? '未指定客人',
    customerPhone: row.customers?.phone ?? null,
    visitCount: row.customers?.visit_count ?? 0,
    dashboardUrl,
    needsConfirm: needsConfirm && reached,
  })

  for (const to of await operatorIds(row.tenant_id)) {
    await pushMessage({
      tenantId: row.tenant_id,
      to,
      messages: [message],
      type: 'new_booking_self',
    })
  }

  return finalStatus
}

/**
 * 超過期限沒確認，時段被釋出。
 *
 * 這則不能省。安靜地釋出等於讓客人抱著一筆已經不存在的預約來現場，
 * 那比多花一則訊息糟糕太多。
 */
export async function notifyBookingExpired(bookingId: string): Promise<void> {
  const row = await load(bookingId)
  if (!row?.tenants || row.tenants.plan !== 'pro') return

  const lineUserId = row.customers?.line_user_id
  if (!lineUserId) return

  await pushMessage({
    tenantId: row.tenant_id,
    to: lineUserId,
    messages: [
      expiredForCustomerMessage({
        booking: briefOf(row),
        tenantName: row.tenants.name,
        bookUrl: `${siteUrl()}/p/${row.tenants.slug}`,
      }),
    ],
    type: 'booking_expired',
    customerId: row.customers?.id ?? null,
  })
}

/** 職人在後台取消一筆還沒發生的預約 */
export async function notifyTenantCancelled(bookingId: string): Promise<void> {
  const row = await load(bookingId)
  if (!row?.tenants || row.tenants.plan !== 'pro') return

  const lineUserId = row.customers?.line_user_id
  if (!lineUserId) return

  const res = await pushMessage({
    tenantId: row.tenant_id,
    to: lineUserId,
    messages: [
      cancelledForCustomerMessage({
        booking: briefOf(row),
        tenantName: row.tenants.name,
        bookUrl: `${siteUrl()}/p/${row.tenants.slug}`,
      }),
    ],
    type: 'booking_cancelled',
    customerId: row.customers?.id ?? null,
  })
  if (!res.ok && row.customers?.id) await markBlocked(row.customers.id)
}

/** 客人自己在 LINE 按了取消 */
export async function notifyCustomerCancelled(
  bookingId: string,
  late: boolean
): Promise<void> {
  const row = await load(bookingId)
  if (!row?.tenants || row.tenants.plan !== 'pro') return

  const hoursLeft = Math.max(
    0,
    Math.round((new Date(row.start_at).getTime() - Date.now()) / 3_600_000)
  )
  const message = customerCancelledForOperatorMessage({
    booking: briefOf(row),
    customerName: row.customers?.name ?? '客人',
    late,
    hoursLeft,
  })

  for (const to of await operatorIds(row.tenant_id)) {
    await pushMessage({
      tenantId: row.tenant_id,
      to,
      messages: [message],
      type: 'customer_cancelled_self',
    })
  }
}
