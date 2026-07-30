// 純函式與型別，前後端共用。
// 刻意不匯入任何伺服器模組——這個檔案會被打包進瀏覽器。

export type TenantPlan = 'free' | 'pro'
export type TenantStatus = 'active' | 'suspended' | 'closed'
export type MemberRole = 'owner' | 'manager' | 'staff'

export type Tenant = {
  id: string
  slug: string
  name: string
  timezone: string
  plan: TenantPlan
  status: TenantStatus
  /** LINE 官方帳號加好友連結。免費方案沒有通知，這是客人唯一找得到職人的地方 */
  line_friend_url: string | null
  contact_phone: string | null
}

export type TenantMember = {
  id: string
  tenant_id: string
  user_id: string
  role: MemberRole
  display_name: string
  is_bookable: boolean
}

export const SLUG_MIN = 3
export const SLUG_MAX = 30

// /p/ 前綴已經把命名空間隔開，這裡只擋掉會造成誤會的字
const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'auth', 'login', 'logout', 'signup', 'register',
  'dashboard', 'settings', 'help', 'support', 'about', 'privacy', 'terms',
  'prolink', 'www', 'new', 'null', 'undefined',
])

/** 使用者可能輸入大寫、空白或底線，統一整理成合法形態 */
export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** 回傳錯誤訊息；合法時回傳 null */
export function validateSlug(slug: string): string | null {
  if (slug.length < SLUG_MIN) return `網址至少要 ${SLUG_MIN} 個字`
  if (slug.length > SLUG_MAX) return `網址最多 ${SLUG_MAX} 個字`
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    return '只能用英文小寫、數字與連字號，開頭結尾不能是連字號'
  }
  if (RESERVED_SLUGS.has(slug)) return '這個網址是保留字，請換一個'
  return null
}
