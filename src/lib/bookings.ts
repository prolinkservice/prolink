// 預約的共用型別與純函式。前後端共用，不匯入伺服器模組。

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'no_show'
  | 'cancelled'
  | 'cancelled_late'
  | 'expired'

export type BookingSource = 'online' | 'manual' | 'line_dm' | 'line_group' | 'walk_in'

export type PaymentMethod =
  | 'cash'
  | 'transfer'
  | 'card'
  | 'hour_pass'
  | 'store_credit'
  | 'mixed'

export type BookingRow = {
  id: string
  kind: 'booking' | 'block'
  start_at: string
  end_at: string
  status: BookingStatus
  source: BookingSource
  quoted_price: number | null
  actual_amount: number | null
  payment_method: PaymentMethod | null
  note: string | null
  internal_note: string | null
  location_id: string | null
  location_name: string | null
  /** 到府服務時客人填的地址。這種預約沒有據點，地址在預約本身上 */
  service_address: string | null
  service_id: string | null
  service_name: string | null
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  /** 出發前心裡有數：這位客人放過幾次鳥（規格 §6.5 的軟性提醒） */
  customer_no_show_points: number
  customer_visit_count: number
  /** 這位客人收得到 LINE 通知嗎（有綁、而且沒把官方帳號封鎖） */
  customer_line_linked: boolean
}

/** 還沒開始、可以直接取消的預約。時間過了要走結案的三選一（規格 §4.2） */
export function canCancel(b: BookingRow, now = Date.now()): boolean {
  return (
    b.kind === 'booking' &&
    (b.status === 'pending' || b.status === 'confirmed') &&
    new Date(b.start_at).getTime() > now
  )
}

/** 狀態不能只靠顏色，一定要有文字（設計鐵則 4） */
export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: '待確認',
  confirmed: '已確認',
  completed: '已完成',
  no_show: '放鳥',
  cancelled: '已取消',
  cancelled_late: '臨時取消',
  expired: '逾時釋出',
}

export const STATUS_TONE: Record<BookingStatus, string> = {
  pending: 'bg-warn-bg text-warn',
  confirmed: 'bg-accent text-accent-foreground',
  completed: 'bg-sunk text-ink-3',
  no_show: 'bg-danger-bg text-danger',
  cancelled: 'bg-sunk text-ink-4',
  cancelled_late: 'bg-danger-bg text-danger',
  expired: 'bg-sunk text-ink-4',
}

export const SOURCE_LABEL: Record<BookingSource, string> = {
  online: '線上預約',
  manual: '手動建立',
  line_dm: 'LINE 建立',
  line_group: 'LINE 群組',
  walk_in: '現場',
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: '現金' },
  { value: 'transfer', label: '轉帳' },
  { value: 'card', label: '刷卡' },
]

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: '現金',
  transfer: '轉帳',
  card: '刷卡',
  hour_pass: '時數券',
  store_credit: '儲值金',
  mixed: '混合付款',
}

/** 結案清單：時間過了兩小時還停在已確認的（規格 §4.2） */
export const CLOSE_GRACE_MS = 2 * 60 * 60 * 1000

export function needsClosing(b: BookingRow, now = Date.now()): boolean {
  return (
    b.kind === 'booking' &&
    b.status === 'confirmed' &&
    new Date(b.end_at).getTime() + CLOSE_GRACE_MS < now
  )
}

export function isInProgress(b: BookingRow, now = Date.now()): boolean {
  return (
    b.kind === 'booking' &&
    (b.status === 'confirmed' || b.status === 'pending') &&
    new Date(b.start_at).getTime() <= now &&
    new Date(b.end_at).getTime() > now
  )
}

/** 還沒發生、還算數的預約。今日行程與統計都用這個口徑 */
export function isLive(b: BookingRow): boolean {
  return b.kind === 'booking' && (b.status === 'confirmed' || b.status === 'pending')
}

/**
 * 預約沒了、時段已經還回去。
 *
 * 這三個狀態的共通點是「別人現在約得到那一格」，所以行事曆與今日行程
 * 都不該再畫出來——畫著會讓老師以為那個時間還被佔著。
 *
 * 一定要走這支而不是自己列狀態：`cancelled_late`（客人臨時取消）
 * 就是這樣被漏掉的，漏掉的那筆在行事曆上長得跟正常預約一模一樣。
 */
export function isDropped(b: BookingRow): boolean {
  return (
    b.status === 'cancelled' || b.status === 'cancelled_late' || b.status === 'expired'
  )
}

/**
 * 算得進營收的預約。
 *
 * 還沒發生的用定價估、已完成的用實收；放鳥與各種取消一律不算——
 * 客人沒來就是沒有收入，把它算進「預計收入」只會讓數字騙自己。
 */
export function countsTowardRevenue(b: BookingRow): boolean {
  return b.kind === 'booking' && (isLive(b) || b.status === 'completed')
}

export function money(n: number | null | undefined): string {
  return Number(n ?? 0).toLocaleString('zh-TW')
}

export function durationMinutes(b: { start_at: string; end_at: string }): number {
  return Math.round(
    (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000
  )
}
