'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, ArrowLeft, Copy, CircleMinus, X, Layers, CalendarDays, CalendarRange } from 'lucide-react'
import Link from 'next/link'
import { BrandMark } from '@/components/BrandMark'

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const SLOT_MINUTES = 30

function formatDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function startOfWeek(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day // 週一為起點
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function buildGridTimes(showEarlyMorning: boolean) {
  const startHour = showEarlyMorning ? 0 : 6
  const times: string[] = []
  for (let h = startHour; h < 24; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return times
}

function enumerateDates(from: string, to: string, weekdays: number[] | null) {
  const dates: string[] = []
  const cur = new Date(from + 'T00:00:00')
  const end = new Date(to + 'T00:00:00')
  while (cur <= end) {
    if (!weekdays || weekdays.includes(cur.getDay())) dates.push(formatDate(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

type Slot = { id: string; start_time: string; end_time: string; is_booked: boolean }

export default function AvailabilityPage() {
  const router = useRouter()
  const [practitionerId, setPractitionerId] = useState<string | null>(null)
  const [today] = useState(new Date())
  const [weekStart, setWeekStart] = useState(startOfWeek(today))
  const [selectedDate, setSelectedDate] = useState(formatDate(today))
  const [slots, setSlots] = useState<Slot[]>([])
  const [showEarlyMorning, setShowEarlyMorning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [panel, setPanel] = useState<null | 'copyMenu' | 'copyRange' | 'copyDate' | 'closeMenu' | 'closeRange'>(null)
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [rangeWeekdays, setRangeWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [singleDate, setSingleDate] = useState('')

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data } = await supabase
        .from('practitioners')
        .select('id, status')
        .eq('user_id', user.id)
        .single()
      if (!data || data.status !== 'approved') { router.push('/practitioner/pending'); return }
      setPractitionerId(data.id)
      setLoading(false)
    })
  }, [router])

  const fetchSlots = useCallback(async () => {
    if (!practitionerId) return
    const supabase = createBrowserSupabaseClient()
    const { data } = await supabase
      .from('availability_slots')
      .select('id, start_time, end_time, is_booked')
      .eq('practitioner_id', practitionerId)
      .gte('start_time', `${selectedDate}T00:00:00`)
      .lt('start_time', `${selectedDate}T23:59:59`)
      .order('start_time')
    setSlots(data ?? [])
  }, [practitionerId, selectedDate])

  useEffect(() => { fetchSlots() }, [fetchSlots])

  const gridTimes = useMemo(() => buildGridTimes(showEarlyMorning), [showEarlyMorning])

  const slotByTime = useMemo(() => {
    const map = new Map<string, Slot>()
    for (const slot of slots) {
      const t = new Date(slot.start_time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
      map.set(t, slot)
    }
    return map
  }, [slots])

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekStart])

  async function toggleCell(time: string) {
    if (!practitionerId || busy) return
    const existing = slotByTime.get(time)
    if (existing?.is_booked) return

    setBusy(true)
    setErrorMsg(null)
    const supabase = createBrowserSupabaseClient()

    if (existing) {
      const { error } = await supabase.from('availability_slots').delete().eq('id', existing.id)
      if (error) setErrorMsg(`關閉失敗：${error.message}`)
    } else {
      const { error } = await supabase.from('availability_slots').insert({
        practitioner_id: practitionerId,
        start_time: `${selectedDate}T${time}:00+08:00`,
        end_time: `${selectedDate}T${addMinutes(time, SLOT_MINUTES)}:00+08:00`,
        is_booked: false,
      })
      if (error) setErrorMsg(`開放失敗：${error.message}`)
    }
    await fetchSlots()
    setBusy(false)
  }

  async function copyOpenPatternToDates(dates: string[]) {
    if (!practitionerId) return
    const openTimes = gridTimes.filter((t) => slotByTime.has(t) && !slotByTime.get(t)?.is_booked)
    const targetDates = dates.filter((d) => d !== selectedDate)
    if (openTimes.length === 0) { setErrorMsg('本日尚無開放時段可複製'); return }
    if (targetDates.length === 0) { setErrorMsg('沒有有效的目標日期'); return }

    setBusy(true)
    setErrorMsg(null)
    const supabase = createBrowserSupabaseClient()
    const sorted = [...targetDates].sort()

    const { data: existingSlots } = await supabase
      .from('availability_slots')
      .select('start_time')
      .eq('practitioner_id', practitionerId)
      .gte('start_time', `${sorted[0]}T00:00:00`)
      .lte('start_time', `${sorted[sorted.length - 1]}T23:59:59`)

    const existingKeySet = new Set(
      (existingSlots ?? []).map((s) => {
        const d = new Date(s.start_time)
        return `${formatDate(d)}T${d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}`
      })
    )

    const rows = targetDates.flatMap((date) =>
      openTimes
        .filter((time) => !existingKeySet.has(`${date}T${time}`))
        .map((time) => ({
          practitioner_id: practitionerId,
          start_time: `${date}T${time}:00+08:00`,
          end_time: `${date}T${addMinutes(time, SLOT_MINUTES)}:00+08:00`,
          is_booked: false,
        }))
    )

    if (rows.length > 0) {
      const { error } = await supabase.from('availability_slots').insert(rows)
      if (error) setErrorMsg(`複製失敗：${error.message}`)
    }
    await fetchSlots()
    setBusy(false)
    setPanel(null)
  }

  async function closeSlotsInDates(dates: string[] | null) {
    if (!practitionerId) return
    setBusy(true)
    setErrorMsg(null)
    const supabase = createBrowserSupabaseClient()

    let query = supabase.from('availability_slots').delete().eq('practitioner_id', practitionerId).eq('is_booked', false)
    if (dates && dates.length > 0) {
      const sorted = [...dates].sort()
      query = query.gte('start_time', `${sorted[0]}T00:00:00`).lte('start_time', `${sorted[sorted.length - 1]}T23:59:59`)
    }
    const { error } = await query
    if (error) setErrorMsg(`關閉失敗：${error.message}`)
    await fetchSlots()
    setBusy(false)
    setPanel(null)
  }

  function toggleWeekday(day: number) {
    setRangeWeekdays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day])
  }

  function prevWeek() {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }
  function nextWeek() {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }
  function goToday() {
    setWeekStart(startOfWeek(today))
    setSelectedDate(formatDate(today))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">載入中...</div>

  const selectedDateObj = new Date(selectedDate + 'T00:00:00')
  const monthLabel = selectedDateObj.toLocaleDateString('zh-TW', { month: 'long' })

  return (
    <div className="min-h-screen bg-background">
      <nav className="lg:hidden sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/practitioner/dashboard">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <span className="font-semibold">時段管理</span>
      <BrandMark />
      </nav>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          📍 點擊時間即可開放/關閉預約。紅色：開放、灰色：關閉。
        </p>

        {/* 週日期條 */}
        <div className="bg-white border border-border rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={prevWeek}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="font-semibold text-sm">{monthLabel}{selectedDateObj.getDate()}日, {selectedDateObj.getFullYear()}</span>
              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={nextWeek}><ChevronRight className="w-4 h-4" /></Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setShowEarlyMorning((v) => !v)}>
                {showEarlyMorning ? '隱藏凌晨' : '顯示凌晨'}
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={goToday}>今天</Button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-center gap-1">
            {weekDays.map((d) => {
              const dateStr = formatDate(d)
              const isSelected = dateStr === selectedDate
              const isWeekend = d.getDay() === 0 || d.getDay() === 6
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className="flex flex-col items-center gap-1 py-1"
                >
                  <span className={`text-xs ${isWeekend ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {WEEKDAY_LABELS[d.getDay()]}
                  </span>
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    isSelected ? 'bg-primary text-white' : isWeekend ? 'text-destructive' : 'text-foreground'
                  }`}>
                    {d.getDate()}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 時間格子 */}
        <div className="bg-white border border-border rounded-xl p-3 max-h-[480px] overflow-y-auto">
          <div className="grid grid-cols-3 gap-2">
            {gridTimes.map((time) => {
              const slot = slotByTime.get(time)
              const isOpen = !!slot
              const isBooked = !!slot?.is_booked
              return (
                <button
                  key={time}
                  onClick={() => toggleCell(time)}
                  disabled={busy || isBooked}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                    isBooked
                      ? 'border-primary/40 bg-primary/10 text-primary cursor-not-allowed'
                      : isOpen
                      ? 'border-destructive text-destructive bg-destructive/5'
                      : 'border-border text-muted-foreground bg-muted/40'
                  }`}
                >
                  {time}
                </button>
              )
            })}
          </div>
        </div>

        {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

        {/* 操作列 */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setPanel('copyMenu')}>
            <Copy className="w-4 h-4 mr-1.5" />複製本日
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => setPanel('closeMenu')} className="text-destructive border-destructive hover:bg-destructive/5">
            <CircleMinus className="w-4 h-4 mr-1.5" />快速關閉
          </Button>
        </div>
      </div>

      {/* 複製本日 - 選單 */}
      {panel === 'copyMenu' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPanel(null)}>
          <div className="bg-white rounded-2xl w-full max-w-xs overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPanel('copyRange')} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 text-left">
              <Layers className="w-4 h-4 text-primary" /><span className="text-sm font-medium">複製到區間日期</span>
            </button>
            <div className="border-t border-border" />
            <button onClick={() => setPanel('copyDate')} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 text-left">
              <CalendarDays className="w-4 h-4 text-primary" /><span className="text-sm font-medium">複製到指定日期</span>
            </button>
          </div>
        </div>
      )}

      {/* 快速關閉 - 選單 */}
      {panel === 'closeMenu' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPanel(null)}>
          <div className="bg-white rounded-2xl w-full max-w-xs overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => closeSlotsInDates([selectedDate])} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 text-left">
              <CircleMinus className="w-4 h-4 text-destructive" /><span className="text-sm font-medium">本日關閉</span>
            </button>
            <div className="border-t border-border" />
            <button onClick={() => setPanel('closeRange')} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 text-left">
              <CalendarRange className="w-4 h-4 text-destructive" /><span className="text-sm font-medium">區間關閉</span>
            </button>
            <div className="border-t border-border" />
            <button
              onClick={() => { if (window.confirm('確定要關閉所有未來的開放時段嗎？此動作無法復原。')) closeSlotsInDates(null) }}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/50 text-left"
            >
              <CalendarDays className="w-4 h-4 text-destructive" /><span className="text-sm font-medium">全部關閉</span>
            </button>
          </div>
        </div>
      )}

      {/* 複製到區間日期 */}
      {panel === 'copyRange' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-sm">複製到區間日期</span>
              <button onClick={() => setPanel(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">每次複製區間最多為 2 年。</p>
            <div className="flex gap-2 mb-4">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">從</label>
                <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="w-full mt-1 rounded-md border border-input px-2 py-1.5 text-sm" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">到</label>
                <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="w-full mt-1 rounded-md border border-input px-2 py-1.5 text-sm" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-2">重複星期</p>
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {WEEKDAY_LABELS.map((label, day) => (
                <button
                  key={day}
                  onClick={() => toggleWeekday(day)}
                  className={`w-9 h-9 rounded-full text-xs font-medium border transition-colors ${
                    rangeWeekdays.includes(day) ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button
              className="w-full"
              size="sm"
              disabled={busy || !rangeFrom || !rangeTo}
              onClick={() => copyOpenPatternToDates(enumerateDates(rangeFrom, rangeTo, rangeWeekdays))}
            >
              確認複製
            </Button>
          </div>
        </div>
      )}

      {/* 複製到指定日期 */}
      {panel === 'copyDate' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-sm">複製到指定日期</span>
              <button onClick={() => setPanel(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <label className="text-xs text-muted-foreground">日期</label>
            <input type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} className="w-full mt-1 mb-4 rounded-md border border-input px-2 py-1.5 text-sm" />
            <Button
              className="w-full"
              size="sm"
              disabled={busy || !singleDate}
              onClick={() => copyOpenPatternToDates([singleDate])}
            >
              確認複製
            </Button>
          </div>
        </div>
      )}

      {/* 區間關閉 */}
      {panel === 'closeRange' && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-sm">區間關閉</span>
              <button onClick={() => setPanel(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="flex gap-2 mb-4">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">從</label>
                <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="w-full mt-1 rounded-md border border-input px-2 py-1.5 text-sm" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">到</label>
                <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="w-full mt-1 rounded-md border border-input px-2 py-1.5 text-sm" />
              </div>
            </div>
            <Button
              className="w-full text-destructive border-destructive hover:bg-destructive/5"
              variant="outline"
              size="sm"
              disabled={busy || !rangeFrom || !rangeTo}
              onClick={() => closeSlotsInDates(enumerateDates(rangeFrom, rangeTo, null))}
            >
              確認關閉
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
