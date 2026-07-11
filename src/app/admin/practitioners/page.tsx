import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react'
import { FREE_CUSTOMER_LIMIT } from '@/lib/subscription'

export default async function AdminPractitionersPage() {
  const supabase = await createServerSupabaseClient()

  const { data: practitioners } = await supabase
    .from('practitioners')
    .select('id, status, is_privileged, profiles ( display_name ), created_at')
    .in('status', ['approved', 'suspended'])
    .order('created_at', { ascending: false })

  const practitionerIds = (practitioners ?? []).map((p) => p.id)
  const todayStr = new Date().toISOString().split('T')[0]

  const [{ data: bookingRows }, { data: subscriptionRows }] = await Promise.all([
    practitionerIds.length > 0
      ? supabase.from('bookings').select('practitioner_id, customer_id').in('practitioner_id', practitionerIds).neq('status', 'cancelled')
      : Promise.resolve({ data: [] }),
    practitionerIds.length > 0
      ? supabase.from('practitioner_subscriptions').select('practitioner_id').in('practitioner_id', practitionerIds).lte('start_date', todayStr).gte('end_date', todayStr)
      : Promise.resolve({ data: [] }),
  ])

  const customerCountByPractitioner = new Map<string, number>()
  const seenPairs = new Set<string>()
  for (const row of bookingRows ?? []) {
    const key = `${row.practitioner_id}:${row.customer_id}`
    if (seenPairs.has(key)) continue
    seenPairs.add(key)
    customerCountByPractitioner.set(row.practitioner_id, (customerCountByPractitioner.get(row.practitioner_id) ?? 0) + 1)
  }
  const subscribedSet = new Set((subscriptionRows ?? []).map((r) => r.practitioner_id))

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
              const customerCount = customerCountByPractitioner.get(p.id) ?? 0
              const isSubscribed = subscribedSet.has(p.id)
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
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {p.is_privileged ? (
                        <span className="text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">特權（無限制）</span>
                      ) : (
                        <>
                          <span className={`text-[11px] px-1.5 py-0.5 rounded ${customerCount >= FREE_CUSTOMER_LIMIT ? 'text-destructive bg-destructive/10' : 'text-muted-foreground bg-muted'}`}>
                            客人數 {customerCount}/{FREE_CUSTOMER_LIMIT}
                          </span>
                          {customerCount >= FREE_CUSTOMER_LIMIT && (
                            <span className={`text-[11px] px-1.5 py-0.5 rounded ${isSubscribed ? 'text-green-700 bg-green-100' : 'text-destructive bg-destructive/10'}`}>
                              {isSubscribed ? '已訂閱' : '未訂閱'}
                            </span>
                          )}
                        </>
                      )}
                    </div>
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
