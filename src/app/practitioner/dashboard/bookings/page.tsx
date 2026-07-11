'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { ClientNoteEditor } from './ClientNoteEditor'
import { updateBookingStatusAction, requestCancellationAsPractitioner } from './actions'
import { BrandMark } from '@/components/BrandMark'

const STATUS_LABEL: Record<string, string> = {
  pending: '待確認',
  confirmed: '已確認',
  completed: '已完成',
  cancelled: '已取消',
}

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'secondary' | 'destructive'> = {
  pending: 'default',
  confirmed: 'secondary',
  completed: 'outline',
  cancelled: 'destructive',
}

const GENDER_LABEL: Record<string, string> = {
  male: '男性',
  female: '女性',
  other: '其他',
}

const PAYMENT_LABEL: Record<string, string> = {
  full_online: '客戶線上付清尾款',
  cash: '客戶現場付現結尾款',
  transfer: '客戶轉帳結尾款',
}

type Booking = {
  id: string
  customer_id: string
  status: string
  payment_method: string
  service_mode: string
  customer_address: string | null
  created_at: string
  availability_slots: { start_time: string; end_time: string } | null
  profiles: { display_name: string | null; gender: string | null } | null
  services: { name: string; price: number } | null
}

export default function PractitionerBookingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [practitionerId, setPractitionerId] = useState<string | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(searchParams.get('status') ?? 'all')
  const [todayOnly, setTodayOnly] = useState(searchParams.get('today') === '1')
  const [pendingCancelIds, setPendingCancelIds] = useState<Set<string>>(new Set())
  const [cancelOpenId, setCancelOpenId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)

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

  const fetchBookings = useCallback(async () => {
    if (!practitionerId) return
    const supabase = createBrowserSupabaseClient()
    let query = supabase
      .from('bookings')
      .select(`
        id, customer_id, status, payment_method, service_mode, customer_address, created_at,
        availability_slots ( start_time, end_time ),
        profiles ( display_name, gender ),
        services ( name, price )
      `)
      .eq('practitioner_id', practitionerId)
      .order('created_at', { ascending: false })

    if (filter !== 'all') query = query.eq('status', filter)
    if (todayOnly) query = query.gte('created_at', new Date().toISOString().split('T')[0])

    const { data } = await query
    const list = (data as unknown as Booking[]) ?? []
    setBookings(list)

    if (list.length > 0) {
      const { data: cancelRows } = await supabase
        .from('cancellation_requests')
        .select('booking_id')
        .eq('status', 'pending_review')
        .in('booking_id', list.map(b => b.id))
      setPendingCancelIds(new Set((cancelRows ?? []).map(r => r.booking_id)))
    }
  }, [practitionerId, filter, todayOnly])

  useEffect(() => { fetchBookings() }, [fetchBookings])

  async function updateStatus(id: string, status: string) {
    const previous = bookings
    setStatusUpdatingId(id)
    // 樂觀更新：先直接改本地狀態，畫面立刻反應不用等重抓整份清單造成閃爍；失敗再復原
    setBookings(prev => prev.map(b => (b.id === id ? { ...b, status } : b)))
    try {
      await updateBookingStatusAction(id, status)
    } catch (err) {
      setBookings(previous)
      alert(err instanceof Error ? err.message : '操作失敗，請再試一次')
    } finally {
      setStatusUpdatingId(null)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">載入中...</div>

  return (
    <div className="min-h-screen bg-background">
      <nav className="lg:hidden sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/practitioner/dashboard">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <span className="font-semibold">預約管理</span>
      <BrandMark />
      </nav>

      <div className="px-4 py-4 max-w-lg mx-auto">
        {/* 篩選 */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          <button
            onClick={() => setTodayOnly(v => !v)}
            className={`px-3 py-1 rounded-full text-sm border whitespace-nowrap transition-colors ${
              todayOnly ? 'bg-primary text-white border-primary' : 'border-input hover:border-primary'
            }`}
          >
            只看今日
          </button>
          {[
            { value: 'all', label: '全部' },
            { value: 'pending', label: '待確認' },
            { value: 'confirmed', label: '已確認' },
            { value: 'completed', label: '已完成' },
            { value: 'cancelled', label: '已取消' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1 rounded-full text-sm border whitespace-nowrap transition-colors ${
                filter === opt.value ? 'bg-primary text-white border-primary' : 'border-input hover:border-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {bookings.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-12">尚無預約紀錄</p>
        ) : (
          <div className="space-y-3">
            {bookings.map(b => {
              const slot = b.availability_slots
              const startStr = slot ? new Date(slot.start_time).toLocaleString('zh-TW', {
                month: 'numeric', day: 'numeric', weekday: 'short',
                hour: '2-digit', minute: '2-digit', hour12: false
              }) : '-'
              const endStr = slot ? new Date(slot.end_time).toLocaleTimeString('zh-TW', {
                hour: '2-digit', minute: '2-digit', hour12: false
              }) : ''

              const profile = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles
              const service = Array.isArray(b.services) ? b.services[0] : b.services

              return (
                <Card key={b.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">
                          {profile?.display_name ?? '顧客'}
                          {profile?.gender && GENDER_LABEL[profile.gender] && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">{GENDER_LABEL[profile.gender]}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{startStr}{endStr ? ` – ${endStr}` : ''}</p>
                      </div>
                      <Badge variant={STATUS_VARIANT[b.status] ?? 'outline'}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
                      {service && <p>服務：{service.name}｜NT${service.price}</p>}
                      <p>付款：{PAYMENT_LABEL[b.payment_method] ?? b.payment_method}｜{b.service_mode === 'on_site' ? '到府' : '到店'}</p>
                      {b.customer_address && <p>地址：{b.customer_address}</p>}
                    </div>

                    {b.status === 'pending' && (
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={statusUpdatingId === b.id}
                        onClick={() => updateStatus(b.id, 'confirmed')}
                      >
                        {statusUpdatingId === b.id ? '確認中...' : '確認接單'}
                      </Button>
                    )}
                    {b.status === 'confirmed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={statusUpdatingId === b.id}
                        onClick={() => updateStatus(b.id, 'completed')}
                      >
                        {statusUpdatingId === b.id ? '處理中...' : '標記完成'}
                      </Button>
                    )}

                    {(b.status === 'pending' || b.status === 'confirmed') && (
                      pendingCancelIds.has(b.id) ? (
                        <p className="text-xs text-muted-foreground mt-2">已送出取消申請，待客服審核</p>
                      ) : cancelOpenId === b.id ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="請說明取消原因"
                            className="w-full text-sm border border-border rounded-md px-3 py-2 min-h-[60px]"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              disabled={cancelSubmitting}
                              onClick={() => { setCancelOpenId(null); setCancelReason('') }}
                            >
                              取消
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1"
                              disabled={cancelSubmitting}
                              onClick={async () => {
                                setCancelSubmitting(true)
                                try {
                                  await requestCancellationAsPractitioner(b.id, cancelReason)
                                  setPendingCancelIds(prev => new Set(prev).add(b.id))
                                  setCancelOpenId(null)
                                  setCancelReason('')
                                } catch (err) {
                                  alert(err instanceof Error ? err.message : '送出失敗，請再試一次')
                                } finally {
                                  setCancelSubmitting(false)
                                }
                              }}
                            >
                              {cancelSubmitting ? '送出中...' : '送出申請'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2"
                          onClick={() => { setCancelOpenId(b.id); setCancelReason('') }}
                        >
                          申請取消
                        </Button>
                      )
                    )}

                    <ClientNoteEditor customerId={b.customer_id} />
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
