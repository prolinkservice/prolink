// 服務項目、可預約標的、據點、排班的共用型別與純函式。
// 這個檔案會被打包進瀏覽器，刻意不匯入任何伺服器模組。

export type BookableType = 'staff' | 'space' | 'equipment'
export type LocationType = 'onsite' | 'mobile'
export type DurationMode = 'fixed' | 'hourly'
export type PriceUnit = 'per_session' | 'per_hour' | 'per_person'
export type LocationMode = 'fixed' | 'multi_site' | 'mobile'
export type PaymentMode = 'none' | 'deposit' | 'full'
export type DepositType = 'none' | 'fixed' | 'percent'

export type Bookable = {
  id: string
  type: BookableType
  name: string
  location_id: string | null
  capacity: number
  is_active: boolean
  /** 場地按小時出租時的單價（type = space 才會用到，規格 §10.2） */
  hourly_price: number | null
  cross_site_travel_min: number
  default_travel_min: number
}

export type Location = {
  id: string
  name: string
  address: string | null
  type: LocationType
  is_active: boolean
  /** 客人選地點時看到的橫幅照片。公開網址，沒傳就是 null */
  photo_url: string | null
}

export type ServiceRow = {
  id: string
  name: string
  category: string | null
  duration_mode: DurationMode
  duration_min: number | null
  min_hours: number | null
  max_hours: number | null
  buffer_before_min: number
  buffer_after_min: number
  price: number
  price_unit: PriceUnit
  location_mode: LocationMode
  location_id: string | null
  service_area: string[] | null
  payment_mode: PaymentMode
  deposit_type: DepositType
  deposit_value: number | null
  capacity: number
  min_headcount: number | null
  is_active: boolean
  /** service_requirements 攤平後的標的 id。引擎靠這個判斷時段能不能約 */
  bookableIds: string[]
}

/** 編輯中的服務。id 為 undefined 代表還沒存過 */
export type ServiceDraft = Omit<ServiceRow, 'id'> & { id?: string }

export const WEEKDAYS = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 0, label: '日' },
] as const

export type BusinessHour = {
  id: string
  bookable_id: string
  location_id: string | null
  weekday: number
  start_time: string
  end_time: string
}

/** 一天之內的一段班。同一天可以有多段，各綁各的地點（規格 §8.5） */
export type DaySegment = {
  start: string
  end: string
  locationId: string | null
}

export type TravelTime = {
  from_location_id: string
  to_location_id: string
  minutes: number
}

export function blankService(): ServiceDraft {
  return {
    name: '',
    category: null,
    duration_mode: 'fixed',
    duration_min: 60,
    min_hours: null,
    max_hours: null,
    buffer_before_min: 0,
    buffer_after_min: 10,
    price: 0,
    price_unit: 'per_session',
    location_mode: 'fixed',
    location_id: null,
    service_area: null,
    payment_mode: 'none',
    deposit_type: 'none',
    deposit_value: null,
    capacity: 1,
    min_headcount: null,
    is_active: true,
    bookableIds: [],
  }
}

/** 資料庫存 '19:00:00'，畫面上只要 '19:00' */
export function toHHMM(time: string): string {
  return time.slice(0, 5)
}

export function describeDuration(s: {
  duration_mode: DurationMode
  duration_min: number | null
  min_hours: number | null
  max_hours: number | null
}): string {
  if (s.duration_mode === 'hourly') {
    const min = s.min_hours ?? 1
    const max = s.max_hours
    return max && max > min ? `${min}–${max} 小時` : `最少 ${min} 小時`
  }
  return s.duration_min ? `${s.duration_min} 分鐘` : '未設定時長'
}

export function formatPrice(s: { price: number; price_unit: PriceUnit }): string {
  const n = Number(s.price).toLocaleString('zh-TW')
  if (s.price_unit === 'per_hour') return `NT$ ${n} / 小時`
  if (s.price_unit === 'per_person') return `NT$ ${n} / 人`
  return `NT$ ${n}`
}

/**
 * 價格單位不讓老師自己選，由時長模式與是否團課推出來——
 * 多一個下拉就多一個填錯的機會，而這兩件事已經決定了答案。
 */
export function derivePriceUnit(draft: {
  duration_mode: DurationMode
  capacity: number
}): PriceUnit {
  if (draft.duration_mode === 'hourly') return 'per_hour'
  if (draft.capacity > 1) return 'per_person'
  return 'per_session'
}

export function describeDeposit(s: {
  payment_mode: PaymentMode
  deposit_type: DepositType
  deposit_value: number | null
}): string | null {
  if (s.payment_mode === 'full') return '全額預收'
  if (s.payment_mode !== 'deposit') return null
  if (s.deposit_type === 'percent') return `定金 ${s.deposit_value ?? 0}%`
  return `定金 NT$ ${Number(s.deposit_value ?? 0).toLocaleString('zh-TW')}`
}
