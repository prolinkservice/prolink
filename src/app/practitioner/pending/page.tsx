import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Clock, XCircle } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function PractitionerPendingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('status, rejection_reason, suspend_reason')
    .eq('user_id', user.id)
    .single()

  if (!practitioner) redirect('/')
  if (practitioner.status === 'approved') redirect('/practitioner/dashboard')

  if (practitioner.status === 'suspended') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <XCircle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">帳號已被下架</h1>
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 max-w-sm mb-6 text-left">
          <p className="text-sm text-foreground leading-relaxed">
            下架原因：{practitioner.suspend_reason || '（管理員未填寫具體原因，請聯繫客服了解詳情）'}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">返回首頁</Link>
        </Button>
      </div>
    )
  }

  if (practitioner.status === 'rejected') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <XCircle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">申請未通過</h1>
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 max-w-sm mb-6 text-left">
          <p className="text-sm text-foreground leading-relaxed">
            退回原因：{practitioner.rejection_reason || '（管理員未填寫具體原因，請聯繫客服了解詳情）'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild>
            <Link href="/practitioner/register">補件重新申請</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">返回首頁</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-4">
        <Clock className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">審核中</h1>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">
        您的入駐申請已成功送出！平台審核通常需要 1–3 個工作天，審核通過後您將可以登入職人後台開始接單。
      </p>
      <Button asChild variant="outline">
        <Link href="/">返回首頁</Link>
      </Button>
    </div>
  )
}
