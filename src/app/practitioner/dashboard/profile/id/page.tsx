import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, IdCard, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { updateIdVerification } from '../actions'

const STATUS_CONFIG: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  pending: { label: '審核中', className: 'text-amber-600 bg-amber-50 border-amber-200', Icon: Clock },
  approved: { label: '已通過', className: 'text-green-600 bg-green-50 border-green-200', Icon: CheckCircle2 },
  rejected: { label: '已退回', className: 'text-destructive bg-destructive/5 border-destructive/20', Icon: XCircle },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  const Icon = cfg.Icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.className}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

export default async function IdVerificationPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('id_front_url, id_back_url, id_verification_status')
    .eq('user_id', user.id)
    .single()

  if (!practitioner) redirect('/')

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/practitioner/dashboard/profile">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold text-lg">身份驗證</span>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <IdCard className="w-4 h-4 text-primary" />
              身份驗證
            </CardTitle>
            <StatusBadge status={practitioner.id_verification_status} />
          </CardHeader>
          <CardContent>
            <form action={updateIdVerification} className="flex flex-col gap-3">
              <div>
                <Label>身分證正面照片網址</Label>
                <Input name="idFrontUrl" defaultValue={practitioner.id_front_url ?? ''} placeholder="https://..." className="mt-1" />
              </div>
              <div>
                <Label>身分證反面照片網址</Label>
                <Input name="idBackUrl" defaultValue={practitioner.id_back_url ?? ''} placeholder="https://..." className="mt-1" />
              </div>
              <p className="text-xs text-muted-foreground -mt-1">Demo 階段請貼上圖片連結</p>
              <Button type="submit" size="sm" className="self-start active:scale-95 transition-transform">
                儲存並送審
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
