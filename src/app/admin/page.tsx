import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Badge } from '@/components/ui/badge'
import { approvePractitioner, rejectPractitioner, approveBank, rejectBank, approveId, rejectId } from './actions'
import { signOut } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { LogOut, Clock, CheckCircle2, MapPin, CreditCard, FileText, Store, IdCard, ChevronRight } from 'lucide-react'
import { AdminReviewLayout, type AdminReviewItem } from './AdminReviewLayout'

const SERVICE_MODE_LABEL: Record<string, string> = {
  at_shop: '到店', on_site: '到府', both: '到店 + 到府'
}

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: approved } = await supabase
    .from('practitioners')
    .select('id, profiles ( display_name ), created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: reviewRaw, error: reviewError } = await supabase
    .from('practitioners')
    .select(`
      id, status, bio, service_mode, shop_address, license_url, created_at,
      bank_name, bank_account, bank_status, passbook_url,
      id_front_url, id_back_url, id_verification_status,
      profiles ( display_name )
    `)
    .or('status.eq.pending,bank_status.eq.pending,id_verification_status.eq.pending')
    .order('created_at', { ascending: true })

  if (reviewError) console.error('admin review query error:', reviewError)

  const reviewList = reviewRaw
    ? await Promise.all(
        reviewRaw.map(async (r) => {
          let passbookSignedUrl: string | null = null
          let idFrontSignedUrl: string | null = null
          let idBackSignedUrl: string | null = null
          if (r.passbook_url) {
            const { data: signed } = await supabase.storage.from('verification-docs').createSignedUrl(r.passbook_url, 60 * 10)
            passbookSignedUrl = signed?.signedUrl ?? null
          }
          if (r.id_front_url) {
            const { data: signed } = await supabase.storage.from('verification-docs').createSignedUrl(r.id_front_url, 60 * 10)
            idFrontSignedUrl = signed?.signedUrl ?? null
          }
          if (r.id_back_url) {
            const { data: signed } = await supabase.storage.from('verification-docs').createSignedUrl(r.id_back_url, 60 * 10)
            idBackSignedUrl = signed?.signedUrl ?? null
          }
          return { ...r, passbookSignedUrl, idFrontSignedUrl, idBackSignedUrl }
        })
      )
    : []

  const reviewItems: AdminReviewItem[] = reviewList.map((r) => {
    const profileRaw = r.profiles as unknown
    const prof = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { display_name: string | null } | null
    const name = prof?.display_name ?? '未知'

    const regPending = r.status === 'pending'
    const bankPending = r.bank_status === 'pending'
    const idPending = r.id_verification_status === 'pending'

    const subtitleParts: string[] = []
    if (regPending) subtitleParts.push('入駐申請')
    if (bankPending) subtitleParts.push('銀行帳戶')
    if (idPending) subtitleParts.push('身份驗證')

    return {
      key: r.id,
      title: name,
      subtitle: subtitleParts.join('、'),
      content: (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <p className="font-bold text-lg text-foreground">{name}</p>
            <p className="text-xs text-muted-foreground">
              申請時間：{new Date(r.created_at).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {regPending && (
            <div className="border-t border-border pt-5 first:border-t-0 first:pt-0">
              <div className="flex items-center gap-2 mb-3">
                <p className="font-semibold text-sm text-foreground">入駐申請</p>
                <Badge variant="outline" className="border-amber-300 text-amber-600 bg-amber-50">待審核</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#F8F7F5] rounded-xl p-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <Store className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">服務方式</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{SERVICE_MODE_LABEL[r.service_mode]}</p>
                </div>
                {r.shop_address && (
                  <div className="bg-[#F8F7F5] rounded-xl p-3.5">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-medium text-muted-foreground">店面地址</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-snug">{r.shop_address}</p>
                  </div>
                )}
                {r.license_url && (
                  <div className="bg-[#F8F7F5] rounded-xl p-3.5">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-medium text-muted-foreground">證照</span>
                    </div>
                    <a href={r.license_url} target="_blank" className="text-sm font-semibold text-primary underline underline-offset-2">點此查看</a>
                  </div>
                )}
              </div>
              {r.bio && (
                <div className="bg-[#F8F7F5] rounded-xl p-4 mb-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">自我介紹</p>
                  <p className="text-sm text-foreground leading-relaxed">{r.bio}</p>
                </div>
              )}
              <div className="flex gap-3">
                <form action={approvePractitioner} className="flex-1">
                  <input type="hidden" name="practitionerId" value={r.id} />
                  <Button type="submit" className="w-full" size="default">
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />核准上架
                  </Button>
                </form>
                <form action={rejectPractitioner} className="space-y-2">
                  <textarea
                    name="reason"
                    placeholder="請填寫退回原因（將顯示給職人）"
                    required
                    className="w-full bg-white border border-border rounded-xl px-3 py-2 text-sm resize-none min-h-[60px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input type="hidden" name="practitionerId" value={r.id} />
                  <Button type="submit" variant="outline" size="default" className="w-full text-destructive border-destructive hover:bg-destructive/5 px-6">退回</Button>
                </form>
              </div>
            </div>
          )}

          {bankPending && (
            <div className="border-t border-border pt-5 first:border-t-0 first:pt-0">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-primary" />
                <p className="font-semibold text-sm text-foreground">銀行帳戶</p>
                <Badge variant="outline" className="border-amber-300 text-amber-600 bg-amber-50">待審核</Badge>
              </div>
              <p className="text-sm text-foreground mb-1">{r.bank_name}　{r.bank_account}</p>
              {r.passbookSignedUrl && (
                <a href={r.passbookSignedUrl} target="_blank" className="text-xs text-primary underline">查看存摺影本</a>
              )}
              <div className="flex gap-2 mt-3">
                <form action={approveBank}>
                  <input type="hidden" name="practitionerId" value={r.id} />
                  <Button type="submit" size="sm">核准</Button>
                </form>
                <form action={rejectBank}>
                  <input type="hidden" name="practitionerId" value={r.id} />
                  <Button type="submit" size="sm" variant="outline" className="text-destructive border-destructive hover:bg-destructive/5">退回</Button>
                </form>
              </div>
            </div>
          )}

          {idPending && (
            <div className="border-t border-border pt-5 first:border-t-0 first:pt-0">
              <div className="flex items-center gap-2 mb-3">
                <IdCard className="w-4 h-4 text-primary" />
                <p className="font-semibold text-sm text-foreground">身份驗證</p>
                <Badge variant="outline" className="border-amber-300 text-amber-600 bg-amber-50">待審核</Badge>
              </div>
              <div className="flex gap-3 text-xs mb-3">
                {r.idFrontSignedUrl && <a href={r.idFrontSignedUrl} target="_blank" className="text-primary underline">正面照片</a>}
                {r.idBackSignedUrl && <a href={r.idBackSignedUrl} target="_blank" className="text-primary underline">反面照片</a>}
              </div>
              <div className="flex gap-2">
                <form action={approveId}>
                  <input type="hidden" name="practitionerId" value={r.id} />
                  <Button type="submit" size="sm">核准</Button>
                </form>
                <form action={rejectId}>
                  <input type="hidden" name="practitionerId" value={r.id} />
                  <Button type="submit" size="sm" variant="outline" className="text-destructive border-destructive hover:bg-destructive/5">退回</Button>
                </form>
              </div>
            </div>
          )}
        </div>
      ),
    }
  })

  return (
    <div className="min-h-screen bg-[#F8F7F5]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <div>
              <span className="font-bold text-base text-foreground">ProLink</span>
              <span className="ml-2 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">管理後台</span>
            </div>
          </div>
          <form action={signOut}>
            <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground">
              <LogOut className="w-4 h-4 mr-1.5" />登出
            </Button>
          </form>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">

        {/* 統計卡片 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-border p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{reviewItems.length}</p>
              <p className="text-sm text-muted-foreground">待審核項目</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-border p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{approved?.length ?? 0}</p>
              <p className="text-sm text-muted-foreground">已上架職人</p>
            </div>
          </div>
        </div>

        {/* 職人待審區 */}
        <section>
          {reviewError && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 mb-4 text-sm text-destructive">
              查詢錯誤：{reviewError.message}
            </div>
          )}
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-bold text-xl text-foreground">職人待審區</h2>
            {reviewItems.length > 0 && (
              <span className="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-full">{reviewItems.length}</span>
            )}
          </div>

          {reviewItems.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border p-10 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">目前沒有待審核的項目</p>
            </div>
          ) : (
            <AdminReviewLayout items={reviewItems} />
          )}
        </section>

        {/* 已上架 */}
        <section>
          <h2 className="font-bold text-xl text-foreground mb-4">已上架職人</h2>
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            {!approved || approved.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">尚無已上架職人</div>
            ) : (
              <div className="divide-y divide-border">
                {approved.map((p, idx) => {
                  const profileRaw = p.profiles as unknown
                  const prof = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { display_name: string | null } | null
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
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString('zh-TW')} 上架
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
