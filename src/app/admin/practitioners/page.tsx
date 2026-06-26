import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react'

export default async function AdminPractitionersPage() {
  const supabase = await createServerSupabaseClient()

  const { data: practitioners } = await supabase
    .from('practitioners')
    .select('id, status, profiles ( display_name ), created_at')
    .in('status', ['approved', 'suspended'])
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-4">
      <h1 className="font-bold text-xl text-foreground">已上架職人</h1>
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {!practitioners || practitioners.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">尚無已上架職人</div>
        ) : (
          <div className="divide-y divide-border">
            {practitioners.map((p, idx) => {
              const profileRaw = p.profiles as unknown
              const prof = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { display_name: string | null } | null
              const isSuspended = p.status === 'suspended'
              return (
                <Link
                  key={p.id}
                  href={`/admin/practitioner/${p.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-[#F8F7F5] transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-foreground">{prof?.display_name ?? '未知'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSuspended ? (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-destructive" />
                        <span className="text-xs text-destructive">已下架</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString('zh-TW')} 上架
                        </span>
                      </>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
