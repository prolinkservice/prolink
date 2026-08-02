// 客戶的共用型別與分群規則。前後端共用，不匯入伺服器模組。

export type CustomerRow = {
  id: string
  name: string
  phone: string | null
  line_user_id: string | null
  /** 他封鎖了官方帳號。有綁但發不出去，跟沒綁一樣收不到通知 */
  line_blocked_at: string | null
  visit_count: number
  total_spent: number
  no_show_points: number
  is_blocked: boolean
  is_exempt: boolean
  first_visit_at: string | null
  last_visit_at: string | null
  created_at: string
}

export type CustomerGroup =
  | 'all'
  | 'new'
  | 'returning'
  | 'sleeping'
  | 'vip'
  | 'no_show'
  | 'blocked'

export const GROUP_LABEL: Record<CustomerGroup, string> = {
  all: '全部',
  new: '新客',
  returning: '回頭客',
  sleeping: '沉睡客',
  vip: 'VIP',
  no_show: '有放鳥紀錄',
  blocked: '已封鎖',
}

/** 沉睡的門檻。規格 §7 定的 90 天 */
export const SLEEPING_DAYS = 90

/** VIP 取消費前 20%。規格 §7 */
export const VIP_RATIO = 0.2

/**
 * VIP 的門檻金額：把有消費的人由高到低排，取前 20% 的最後一位。
 * 用「排名」而不是固定金額，因為每家店的客單價差十倍以上。
 */
export function vipThreshold(customers: CustomerRow[]): number {
  const spent = customers
    .map((c) => Number(c.total_spent))
    .filter((n) => n > 0)
    .sort((a, b) => b - a)
  if (spent.length === 0) return Infinity
  const index = Math.max(0, Math.ceil(spent.length * VIP_RATIO) - 1)
  return spent[index]
}

export function daysSince(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null
  return Math.floor((now - new Date(iso).getTime()) / 86400000)
}

/**
 * 一位客人屬於哪些群。刻意可以同時屬於多群——
 * 沉睡的 VIP 是最該打電話的那種人，不該被歸成其中一類就看不到另一面。
 */
export function groupsOf(
  customer: CustomerRow,
  opts: { vipFrom: number; now?: number }
): CustomerGroup[] {
  const groups: CustomerGroup[] = ['all']

  if (customer.is_blocked) groups.push('blocked')
  if (Number(customer.no_show_points) > 0) groups.push('no_show')
  if (customer.visit_count <= 1) groups.push('new')
  if (customer.visit_count >= 2) groups.push('returning')

  const idle = daysSince(customer.last_visit_at, opts.now ?? Date.now())
  if (customer.visit_count > 0 && idle !== null && idle >= SLEEPING_DAYS) {
    groups.push('sleeping')
  }
  if (Number(customer.total_spent) > 0 && Number(customer.total_spent) >= opts.vipFrom) {
    groups.push('vip')
  }

  return groups
}

export function matchesQuery(customer: CustomerRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const digits = q.replace(/\D/g, '')
  if (digits && customer.phone?.includes(digits)) return true
  return customer.name.toLowerCase().includes(q)
}

/** 07/12 這種短日期。列表上不需要年份 */
export function shortDate(iso: string | null, timeZone: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone,
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}
