import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Clock } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { AdminReviewLayout, type AdminReviewItem } from '../AdminReviewLayout'
import { approveCancellation, rejectCancellation } from '../actions'
import { calcRefundAmount } from '@/lib/cancellation'

const REQUESTED_BY_LABEL: Record<string, string> = {
  customer: '客人申請',
  practitioner: '老師申請',
  system: '系統自動取消',
}

export default async function AdminCancellationRequestsPage() {
  const supabase = await createServerSupabaseClient()

  const { data: requests, error } = await supabase
    .from('cancellation_requests')
    .select(`
      id, requested_by, reason, status, created_at,
      bookings (
        id, payment_status, payment_method, total_amount, deposit_amount,
        availability_slots ( start_time ),
        services ( name ),
        profiles ( display_name ),
        practitioners ( profiles ( display_name ) )
      )
    `)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })

  if (error) console.error('admin cancellation-requests query error:', error)

  const items: AdminReviewItem[] = (requests ?? []).map((r) => {
    const booking = Array.isArray(r.bookings) ? r.bookings[0] : r.bookings
    const slot = Array.isArray(booking?.availability_slots) ? booking?.availability_slots[0] : booking?.availability_slots
    const service = Array.isArray(booking?.services) ? booking?.services[0] : booking?.services
    const customerProfile = Array.isArray(booking?.profiles) ? booking?.profiles[0] : booking?.profiles
    const practitionerRaw = Array.isArray(booking?.practitioners) ? booking?.practitioners[0] : booking?.practitioners
    const practitionerProfile = Array.isArray(practitionerRaw?.profiles) ? practitionerRaw?.profiles[0] : practitionerRaw?.profiles

    const previewRefund = booking && slot
      ? calcRefundAmount(booking, r.requested_by as 'customer' | 'practitioner' | 'system', slot.start_time)
      : 0

    const slotStr = slot
      ? new Date(slot.start_time).toLocaleString('zh-TW', {
          month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei',
        })
      : '-'

    return {
      key: r.id,
      title: service?.name ?? '預約取消申請',
      subtitle: REQUESTED_BY_LABEL[r.requested_by] ?? r.requested_by,
      content: (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="font-bold text-lg text-foreground">{service?.name ?? '預約取消申請'}</p>
            <Badge variant="outline" className="border-amber-300 text-amber-600 bg-amber-50">
              <Clock className="w-3 h-3 mr-1" />待審核
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F8F7F5] rounded-xl p-3.5">
              <p className="text-xs font-medium text-muted-foreground mb-1">客人</p>
              <p className="text-sm font-semibold text-foreground">{customerProfile?.display_name ?? '-'}</p>
            </div>
            <div className="bg-[#F8F7F5] rounded-xl p-3.5">
              <p className="text-xs font-medium text-muted-foreground mb-1">老師</p>
              <p className="text-sm font-semibold text-foreground">{practitionerProfile?.display_name ?? '-'}</p>
            </div>
            <div className="bg-[#F8F7F5] rounded-xl p-3.5">
              <p className="text-xs font-medium text-muted-foreground mb-1">預約時段</p>
              <p className="text-sm font-semibold text-foreground">{slotStr}</p>
            </div>
            <div className="bg-[#F8F7F5] rounded-xl p-3.5">
              <p className="text-xs font-medium text-muted-foreground mb-1">申請人</p>
              <p className="text-sm font-semibold text-foreground">{REQUESTED_BY_LABEL[r.requested_by] ?? r.requested_by}</p>
            </div>
          </div>

          {r.reason && (
            <div className="bg-[#F8F7F5] rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">取消原因</p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{r.reason}</p>
            </div>
          )}

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">依規則預估退款金額（核准時依實際送出時間重新計算）</p>
            <p className="text-base font-bold text-primary">
              {previewRefund > 0 ? `NT$${previewRefund.toLocaleString()}` : '不退款'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">距服務時段24小時內取消不退款；系統自動取消（老師逾時未接單）一律全額退款</p>
          </div>

          <div className="flex gap-3">
            <form action={approveCancellation} className="flex-1">
              <input type="hidden" name="requestId" value={r.id} />
              <Button type="submit" className="w-full">
                <CheckCircle2 className="w-4 h-4 mr-1.5" />核准取消{previewRefund > 0 ? '＋退款' : ''}
              </Button>
            </form>
            <form action={rejectCancellation} className="flex-1 space-y-2">
              <textarea
                name="reason"
                placeholder="請填寫退回原因（將通知申請人）"
                required
                className="w-full bg-white border border-border rounded-xl px-3 py-2 text-sm resize-none min-h-[44px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input type="hidden" name="requestId" value={r.id} />
              <Button type="submit" variant="outline" className="w-full text-destructive border-destructive hover:bg-destructive/5">駁回申請</Button>
            </form>
          </div>
        </div>
      ),
    }
  })

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 text-sm text-destructive">
          查詢錯誤：{error.message}
        </div>
      )}
      <div className="flex items-center gap-3">
        <h1 className="font-bold text-xl text-foreground">取消審核</h1>
        {items.length > 0 && (
          <span className="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-full">{items.length}</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-10 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">目前沒有待審核的取消申請</p>
        </div>
      ) : (
        <AdminReviewLayout items={items} />
      )}
    </div>
  )
}
