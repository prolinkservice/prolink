import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Clock, CheckCircle2, ChevronRight } from 'lucide-react'

export default async function AdminOverviewPage() {
  const supabase = await createServerSupabaseClient()

  const [{ count: pendingCount }, { count: approvedCount }] = await Promise.all([
    supabase
      .from('practitioners')
      .select('*', { count: 'exact', head: true })
      .or('status.eq.pending,bank_status.eq.pending,id_verification_status.eq.pending'),
    supabase
      .from('practitioners')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved'),
  ])

  return (
    <div className="space-y-6">
      <h1 className="font-bold text-xl text-foreground">總覽</h1>

      <div className="grid grid-cols-2 gap-4">
        <Link href="/admin/review" className="bg-white rounded-2xl border border-border p-5 flex items-center gap-4 hover:border-primary/40 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-amber-500" />
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-foreground">{pendingCount ?? 0}</p>
            <p className="text-sm text-muted-foreground">待審核項目</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </Link>
        <Link href="/admin/practitioners" className="bg-white rounded-2xl border border-border p-5 flex items-center gap-4 hover:border-primary/40 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-foreground">{approvedCount ?? 0}</p>
            <p className="text-sm text-muted-foreground">已上架職人</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </Link>
      </div>
    </div>
  )
}
