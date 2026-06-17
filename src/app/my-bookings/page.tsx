'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createBrowserSupabaseClient } from '@/lib/supabase'

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
  deposit: '付定金',
  full_online: '線上全額',
  cash: '現場付現',
  transfer: '轉帳',
}

type Booking = {
  id: string
  status: string
  payment_method: string
  service_mode: string
  customer_address: string | null
  created_at: string
  availability_slots: { start_time: string; end_time: string } | null
  practitioners: { profiles: { display_name: string | null } | null } | null
  services: { name: string; price: number } | null
}

export default function MyBookingsPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }

      let query = supabase
        .from('bookings')
        .select(`
          id, status, payment_method, service_mode, customer_address, created_at,
          availability_slots ( start_time, end_time ),
          practitioners ( profiles ( display_name ) ),
          services ( name, price )
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })

      if (filter !== 'all') query = query.eq('status', filter)

      const { data } = await query
      setBookings((data as unknown as Booking[]) ?? [])
      setLoading(false)
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
              <Link href="/">去找師傅</Link>
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

              return (
                <Card key={b.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{prof?.display_name ?? '師傅'}</p>
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
