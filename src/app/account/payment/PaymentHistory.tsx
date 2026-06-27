import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreditCard } from 'lucide-react'

const PAYMENT_STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'outline' | 'secondary' | 'destructive' }> = {
  unpaid: { label: '未付款', variant: 'destructive' },
  partially_paid: { label: '已付訂金', variant: 'secondary' },
  paid: { label: '已付款', variant: 'default' },
  refunded: { label: '已退款', variant: 'outline' },
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  full_online: '線上付清',
  cash: '現場付現',
  transfer: '轉帳',
}

export async function PaymentHistory() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, status, payment_method, payment_status, total_amount, deposit_amount, merchant_trade_no, created_at,
      services ( name ),
      practitioners ( profiles ( display_name ) )
    `)
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  if (!bookings || bookings.length === 0) {
    return (
      <div className="py-10 flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
          <CreditCard className="w-7 h-7 text-primary" />
        </div>
        <p className="text-muted-foreground text-sm">尚無付款紀錄</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {bookings.map((b) => {
        const service = Array.isArray(b.services) ? b.services[0] : b.services
        const practitionerRaw = b.practitioners as unknown
        const practitioner = Array.isArray(practitionerRaw) ? practitionerRaw[0] : practitionerRaw
        const profileRaw = (practitioner as { profiles?: unknown })?.profiles
        const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw
        const teacherName = (profile as { display_name?: string } | null)?.display_name ?? '老師'
        const status = PAYMENT_STATUS_LABEL[b.payment_status] ?? PAYMENT_STATUS_LABEL.unpaid
        const amount = b.payment_status === 'partially_paid' ? b.deposit_amount : b.total_amount
        const dateStr = new Date(b.created_at).toLocaleDateString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric' })

        return (
          <Card key={b.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm">{service?.name ?? '服務'}</p>
                  <p className="text-xs text-muted-foreground">{teacherName} · {dateStr}</p>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>金額：NT${Math.round(amount ?? 0)}{b.payment_status === 'partially_paid' ? '（訂金）' : ''}</p>
                <p>付款方式：{PAYMENT_METHOD_LABEL[b.payment_method] ?? b.payment_method}</p>
                {b.merchant_trade_no && <p>訂單編號：{b.merchant_trade_no}</p>}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
