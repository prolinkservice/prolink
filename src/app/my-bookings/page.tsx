'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { BrandMark } from '@/components/BrandMark'
import { requestCancellationAsCustomer } from './actions'

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

const PAYMENT_LABEL: Record<string, string> = {
  full_online: '線上付清尾款',
  cash: '現場付現結尾款',
  transfer: '轉帳結尾款',
}

type Booking = {
  id: string
  status: string
  payment_method: string
  service_mode: string
  customer_address: string | null
  created_at: string
  availability_slots: { start_time: string; end_time: string } | null
  practitioners: { id: string; profiles: { display_name: string | null } | null } | null
  services: { name: string; price: number } | null
  reviews: { id: string } | { id: string }[] | null
}

export default function MyBookingsPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [pendingCancelIds, setPendingCancelIds] = useState<Set<string>>(new Set())
  const [cancelOpenId, setCancelOpenId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSubmitting, setCancelSubmitting] = useState(false)
  const [cancelAckNoRefund, setCancelAckNoRefund] = useState(false)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }

      let query = supabase
        .from('bookings')
        .select(`
          id, status, payment_method, service_mode, customer_address, created_at,
          availability_slots ( start_time, end_time ),
          practitioners ( id, profiles ( display_name ) ),
          services ( name, price ),
          reviews ( id )
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })

      if (filter !== 'all') query = query.eq('status', filter)

      const { data } = await query
      const list = (data as unknown as Booking[]) ?? []
      setBookings(list)
      setLoading(false)

      if (list.length > 0) {
        const { data: cancelRows } = await supabase
          .from('cancellation_requests')
          .select('booking_id')
          .eq('status', 'pending_review')
          .in('booking_id', list.map(b => b.id))
        setPendingCancelIds(new Set((cancelRows ?? []).map(r => r.booking_id)))
      }

      const practitionerIds = Array.from(new Set(
        list.map(b => {
          const pract = Array.isArray(b.practitioners) ? b.practitioners[0] : b.practitioners
          return pract?.id
        }).filter((id): id is string => !!id)
      ))
      if (practitionerIds.length > 0) {
        const { data: noteRows } = await supabase
          .from('client_notes')
          .select('practitioner_id, note')
          .eq('customer_id', user.id)
          .in('practitioner_id', practitionerIds)
        const map: Record<string, string> = {}
        for (const row of noteRows ?? []) {
          if (row.note) map[row.practitioner_id] = row.note
        }
        setNotes(map)
      }
    })
  }, [router, filter])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">載入中...</div>
  )

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <span className="font-semibold">我的預約</span>
      <BrandMark />
      </nav>

      <div className="px-4 py-4 max-w-lg mx-auto">
        {/* 篩選標籤 */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
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
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm mb-4">尚無預約紀錄</p>
            <Button asChild size="sm">
              <Link href="/">去找老師</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map(b => {
              const slot = b.availability_slots
              const startStr = slot ? new Date(slot.start_time).toLocaleString('zh-TW', {
                month: 'numeric', day: 'numeric', weekday: 'short',
                hour: '2-digit', minute: '2-digit', hour12: false,
                timeZone: 'Asia/Taipei',
              }) : '-'
              const endStr = slot ? new Date(slot.end_time).toLocaleTimeString('zh-TW', {
                hour: '2-digit', minute: '2-digit', hour12: false,
                timeZone: 'Asia/Taipei',
              }) : ''

              const practRaw = Array.isArray(b.practitioners) ? b.practitioners[0] : b.practitioners
              const profRaw = practRaw?.profiles
              const prof = Array.isArray(profRaw) ? profRaw[0] : profRaw
              const service = Array.isArray(b.services) ? b.services[0] : b.services
              const note = practRaw?.id ? notes[practRaw.id] : undefined

              return (
                <Card key={b.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{prof?.display_name ?? '老師'}</p>
                        <p className="text-xs text-muted-foreground">{startStr}{endStr ? ` – ${endStr}` : ''}</p>
                      </div>
                      <Badge variant={STATUS_VARIANT[b.status] ?? 'outline'}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {service && <p>服務：{service.name}｜NT${service.price}</p>}
                      <p>付款：{PAYMENT_LABEL[b.payment_method] ?? b.payment_method}｜{b.service_mode === 'on_site' ? '到府' : '到店'}</p>
                      {b.customer_address && <p>地址：{b.customer_address}</p>}
                    </div>

                    {note && (
                      <div className="mt-3 p-2 rounded-md bg-muted/50 border border-border">
                        <p className="text-xs font-medium text-foreground mb-0.5">老師的體質紀錄</p>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{note}</p>
                      </div>
                    )}

                    {b.status === 'completed' && (
                      (Array.isArray(b.reviews) ? b.reviews.length > 0 : !!b.reviews) ? (
                        <p className="text-xs text-primary font-medium mt-3">已評價，謝謝你的回饋！</p>
                      ) : (
                        <Button asChild size="sm" className="w-full mt-3 active:scale-95 transition-transform">
                          <Link href={`/review/${b.id}`}>給評價</Link>
                        </Button>
                      )
                    )}

                    {(b.status === 'pending' || b.status === 'confirmed') && (() => {
                      const withinNoRefundWindow = !!slot && (new Date(slot.start_time).getTime() - Date.now()) < 24 * 60 * 60 * 1000
                      const canSubmit = !cancelSubmitting && (!withinNoRefundWindow || cancelAckNoRefund)

                      return pendingCancelIds.has(b.id) ? (
                        <p className="text-xs text-muted-foreground mt-3">已送出取消申請，待客服審核</p>
                      ) : cancelOpenId === b.id ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="請說明取消原因"
                            className="w-full text-sm border border-border rounded-md px-3 py-2 min-h-[60px]"
                          />
                          {withinNoRefundWindow && (
                            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                              <p className="text-xs font-semibold text-destructive mb-1.5">距服務時段已不到24小時，依規定此次取消將不予退款</p>
                              <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={cancelAckNoRefund}
                                  onChange={(e) => setCancelAckNoRefund(e.target.checked)}
                                  className="mt-0.5"
                                />
                                我已了解，24小時內取消不予退款，仍要送出取消申請
                              </label>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              disabled={cancelSubmitting}
                              onClick={() => { setCancelOpenId(null); setCancelReason(''); setCancelAckNoRefund(false) }}
                            >
                              取消
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1"
                              disabled={!canSubmit}
                              onClick={async () => {
                                setCancelSubmitting(true)
                                try {
                                  await requestCancellationAsCustomer(b.id, cancelReason)
                                  setPendingCancelIds(prev => new Set(prev).add(b.id))
                                  setCancelOpenId(null)
                                  setCancelReason('')
                                  setCancelAckNoRefund(false)
                                } catch (err) {
                                  alert(err instanceof Error ? err.message : '送出失敗，請再試一次')
                                } finally {
                                  setCancelSubmitting(false)
                                }
                              }}
                            >
                              {cancelSubmitting ? '送出中...' : '確定取消'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-3"
                          onClick={() => { setCancelOpenId(b.id); setCancelReason(''); setCancelAckNoRefund(false) }}
                        >
                          申請取消
                        </Button>
                      )
                    })()}
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
