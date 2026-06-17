'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { ChevronLeft, ChevronRight, Plus, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)

function formatDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

type Slot = { id: string; start_time: string; end_time: string; is_booked: boolean }

export default function AvailabilityPage() {
  const router = useRouter()
  const [practitionerId, setPractitionerId] = useState<string | null>(null)
  const [today] = useState(new Date())
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(formatDate(today))
  const [slots, setSlots] = useState<Slot[]>([])
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(true)

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

  async function addSlot() {
    if (!practitionerId) return
    if (startTime >= endTime) { alert('結束時間必須晚於開始時間'); return }
    setAdding(true)
    const supabase = createBrowserSupabaseClient()
    await supabase.from('availability_slots').insert({
      practitioner_id: practitionerId,
      start_time: `${selectedDate}T${startTime}:00+08:00`,
      end_time: `${selectedDate}T${endTime}:00+08:00`,
      is_booked: false,
    })
    await fetchSlots()
    setAdding(false)
  }

  async function deleteSlot(id: string) {
    const supabase = createBrowserSupabaseClient()
    await supabase.from('availability_slots').delete().eq('id', id)
    await fetchSlots()
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">載入中...</div>

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/practitioner/dashboard">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <span className="font-semibold">時段管理</span>
      </nav>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {/* 月曆 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="font-semibold text-sm">{monthLabel}</span>
              <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
            </div>
            <div className="grid grid-cols-7 text-center mb-1">
              {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                <span key={d} className="text-xs text-muted-foreground py-1">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 text-center gap-y-1">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => <span key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const isSelected = dateStr === selectedDate
                const isToday = dateStr === formatDate(today)
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`w-8 h-8 mx-auto rounded-full text-sm transition-colors ${
                      isSelected ? 'bg-primary text-white' :
                      isToday ? 'border border-primary text-primary' :
                      'hover:bg-accent'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* 選定日期的時段 */}
        <div>
          <h2 className="font-semibold text-sm mb-2">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' })} 的時段
          </h2>

          {slots.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">尚無時段，請新增</p>
          ) : (
            <div className="space-y-2 mb-3">
              {slots.map(slot => {
                const start = new Date(slot.start_time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
                const end = new Date(slot.end_time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
                return (
                  <div key={slot.id} className="flex items-center justify-between bg-white border border-border rounded-lg px-4 py-2.5">
                    <span className="text-sm font-medium">{start} – {end}</span>
                    {slot.is_booked ? (
                      <span className="text-xs text-primary font-medium">已預約</span>
                    ) : (
                      <button onClick={() => deleteSlot(slot.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* 新增時段 */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium mb-3">新增時段</p>
              <div className="flex gap-2 items-center mb-3">
                <select
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                >
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="text-muted-foreground text-sm">到</span>
                <select
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                >
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <Button className="w-full" size="sm" onClick={addSlot} disabled={adding}>
                <Plus className="w-4 h-4 mr-1" />
                {adding ? '新增中...' : '新增此時段'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
