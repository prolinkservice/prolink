import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, Star, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { markAllNotificationsRead } from './actions'

const TYPE_ICON: Record<string, typeof Calendar> = {
  new_booking: Calendar,
  new_review: Star,
  verification_result: ShieldCheck,
}

const toTaipei = (iso: string) => new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000)
const fmt = (iso: string) => {
  const d = toTaipei(iso)
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const h = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${m}/${day} ${h}:${min}`
}

export default async function NotificationsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, is_read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  await markAllNotificationsRead()

  return (
    <div className="min-h-screen bg-background">
      <nav className="lg:hidden sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/practitioner/dashboard">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <span className="font-semibold">通知中心</span>
      </nav>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-2">
        {!notifications || notifications.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-12">目前沒有任何通知</p>
        ) : (
          notifications.map((n) => {
            const Icon = TYPE_ICON[n.type] ?? Calendar
            const content = (
              <Card className={n.is_read ? '' : 'border-primary/40 bg-accent/30'}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1.5">{fmt(n.created_at)}</p>
                  </div>
                </CardContent>
              </Card>
            )
            return n.link ? (
              <Link key={n.id} href={n.link}>{content}</Link>
            ) : (
              <div key={n.id}>{content}</div>
            )
          })
        )}
      </div>
    </div>
  )
}
