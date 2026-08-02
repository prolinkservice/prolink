// 時區工具。整個系統的規矩：資料庫一律存 timestamptz，
// 畫面一律用「租戶的時區」呈現——老師人在高雄，看到的就該是台北時間，
// 不是伺服器所在地的時間，也不是客人手機的時區。

function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second')
  )
  return asUtc - at.getTime()
}

/** 'YYYY-MM-DD' + 'HH:mm' 在該時區代表的那個瞬間 */
export function zonedTime(date: string, time: string, timeZone: string): Date {
  const guess = new Date(`${date}T${time}:00Z`)
  return new Date(guess.getTime() - zoneOffsetMs(guess, timeZone))
}

/** 某一天在該時區的起訖，拿來當資料庫查詢的邊界 */
export function zonedDayRange(date: string, timeZone: string): { start: Date; end: Date } {
  const start = zonedTime(date, '00:00', timeZone)
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) }
}

/** 該時區的今天，YYYY-MM-DD */
export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** 那一週的星期一。行事曆週檢視用 */
export function startOfWeek(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  return addDays(date, weekday === 0 ? -6 : 1 - weekday)
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

/** 8/6（三）19:00。LINE 訊息裡用，客人一眼要看得懂是哪一天 */
export function formatDateTime(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('zh-TW', {
    timeZone,
    month: 'numeric',
    day: 'numeric',
    weekday: 'narrow',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('month')}/${get('day')}（${get('weekday')}）${get('hour')}:${get('minute')}`
}

/** 08/02（六） */
export function formatDayLabel(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}（${'日一二三四五六'[weekday]}）`
}

/** 該時區裡這個瞬間是幾點幾分，回傳從當天 00:00 算起的分鐘數 */
export function minutesOfDay(iso: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return (get('hour') % 24) * 60 + get('minute')
}
