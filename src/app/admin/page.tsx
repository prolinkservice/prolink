import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { approvePractitioner, rejectPractitioner, approveBank, rejectBank, approveId, rejectId } from './actions'
import { signOut } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { LogOut, Clock, CheckCircle2, MapPin, CreditCard, FileText, User, Store, IdCard } from 'lucide-react'

const SERVICE_MODE_LABEL: Record<string, string> = {
  at_shop: '到店', on_site: '到府', both: '到店 + 到府'
}

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: pending, error: pendingError } = await supabase
    .from('practitioners')
    .select(`id, bio, service_mode, shop_address, license_url, bank_name, bank_account, created_at, profiles ( display_name )`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (pendingError) console.error('admin pending query error:', pendingError)

  const { data: approved } = await supabase
    .from('practitioners')
    .select('id, profiles ( display_name ), created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: bankReviews } = await supabase
    .from('practitioners')
    .select('id, bank_name, bank_account, profiles ( display_name )')
    .eq('status', 'approved')
    .eq('bank_status', 'pending')
    .not('bank_name', 'is', null)

  const { data: idReviews } = await supabase
    .from('practitioners')
    .select('id, id_front_url, id_back_url, profiles ( display_name )')
    .eq('status', 'approved')
    .eq('id_verification_status', 'pending')
    .not('id_front_url', 'is', null)

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
              <p className="text-2xl font-bold text-foreground">{pending?.length ?? 0}</p>
              <p className="text-sm text-muted-foreground">待審核申請</p>
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

        {/* 待審核 */}
        <section>
          {pendingError && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 mb-4 text-sm text-destructive">
              查詢錯誤：{pendingError.message}
            </div>
          )}
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-bold text-xl text-foreground">待審核申請</h2>
            {(pending?.length ?? 0) > 0 && (
              <span className="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {pending!.length}
              </span>
            )}
          </div>

          {!pending || pending.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border p-10 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">目前沒有待審核的申請</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map(p => {
                const profileRaw = p.profiles as unknown
                const prof = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { display_name: string | null } | null
                return (
                  <div key={p.id} className="bg-white rounded-2xl border border-border overflow-hidden">
                    {/* 頂部色條 */}
                    <div className="h-1 bg-gradient-to-r from-primary to-[#6FAE82]" />

                    <div className="p-6">
                      {/* 標頭 */}
                      <div className="flex items-start justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-bold text-base text-foreground">{prof?.display_name ?? '未知'}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              申請時間：{new Date(p.created_at).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="border-amber-300 text-amber-600 bg-amber-50">
                          待審核
                        </Badge>
                      </div>

                      {/* 資料區塊 */}
                      <div className="grid grid-cols-2 gap-3 mb-5">
                        <div className="bg-[#F8F7F5] rounded-xl p-3.5">
                          <div className="flex items-center gap-2 mb-1">
                            <Store className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-medium text-muted-foreground">服務方式</span>
                          </div>
                          <p className="text-sm font-semibold text-foreground">{SERVICE_MODE_LABEL[p.service_mode]}</p>
                        </div>

                        {p.shop_address && (
                          <div className="bg-[#F8F7F5] rounded-xl p-3.5">
                            <div className="flex items-center gap-2 mb-1">
                              <MapPin className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-medium text-muted-foreground">店面地址</span>
                            </div>
                            <p className="text-sm font-semibold text-foreground leading-snug">{p.shop_address}</p>
                          </div>
                        )}

                        {p.bank_name && (
                          <div className="bg-[#F8F7F5] rounded-xl p-3.5">
                            <div className="flex items-center gap-2 mb-1">
                              <CreditCard className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-medium text-muted-foreground">收款資料</span>
                            </div>
                            <p className="text-sm font-semibold text-foreground">{p.bank_name}</p>
                            <p className="text-xs text-muted-foreground">{p.bank_account}</p>
                          </div>
                        )}

                        {p.license_url && (
                          <div className="bg-[#F8F7F5] rounded-xl p-3.5">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-medium text-muted-foreground">證照</span>
                            </div>
                            <a href={p.license_url} target="_blank" className="text-sm font-semibold text-primary underline underline-offset-2">
                              點此查看
                            </a>
                          </div>
                        )}
                      </div>

                      {/* 自我介紹 */}
                      {p.bio && (
                        <div className="bg-[#F8F7F5] rounded-xl p-4 mb-5">
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">自我介紹</p>
                          <p className="text-sm text-foreground leading-relaxed">{p.bio}</p>
                        </div>
                      )}

                      {/* 操作按鈕 */}
                      <div className="flex gap-3">
                        <form action={approvePractitioner} className="flex-1">
                          <input type="hidden" name="practitionerId" value={p.id} />
                          <Button type="submit" className="w-full" size="default">
                            <CheckCircle2 className="w-4 h-4 mr-1.5" />
                            核准上架
                          </Button>
                        </form>
                        <form action={rejectPractitioner}>
                          <input type="hidden" name="practitionerId" value={p.id} />
                          <Button type="submit" variant="outline" size="default" className="text-destructive border-destructive hover:bg-destructive/5 px-6">
                            退回
                          </Button>
                        </form>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
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
                    <div key={p.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[#F8F7F5] transition-colors">
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
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* 銀行帳戶審核 */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-bold text-xl text-foreground">銀行帳戶待審</h2>
            {(bankReviews?.length ?? 0) > 0 && (
              <span className="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-full">{bankReviews!.length}</span>
            )}
          </div>
          {!bankReviews || bankReviews.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border p-8 text-center text-muted-foreground text-sm">目前沒有待審核的銀行資料</div>
          ) : (
            <div className="space-y-3">
              {bankReviews.map(b => {
                const profileRaw = b.profiles as unknown
                const prof = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { display_name: string | null } | null
                return (
                  <div key={b.id} className="bg-white rounded-2xl border border-border p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
                        <CreditCard className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{prof?.display_name ?? '未知'}</p>
                        <p className="text-xs text-muted-foreground">{b.bank_name}　{b.bank_account}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <form action={approveBank}>
                        <input type="hidden" name="practitionerId" value={b.id} />
                        <Button type="submit" size="sm">核准</Button>
                      </form>
                      <form action={rejectBank}>
                        <input type="hidden" name="practitionerId" value={b.id} />
                        <Button type="submit" size="sm" variant="outline" className="text-destructive border-destructive hover:bg-destructive/5">退回</Button>
                      </form>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* 身份驗證審核 */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-bold text-xl text-foreground">身份驗證待審</h2>
            {(idReviews?.length ?? 0) > 0 && (
              <span className="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-full">{idReviews!.length}</span>
            )}
          </div>
          {!idReviews || idReviews.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border p-8 text-center text-muted-foreground text-sm">目前沒有待審核的身份資料</div>
          ) : (
            <div className="space-y-3">
              {idReviews.map(idv => {
                const profileRaw = idv.profiles as unknown
                const prof = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { display_name: string | null } | null
                return (
                  <div key={idv.id} className="bg-white rounded-2xl border border-border p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
                        <IdCard className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{prof?.display_name ?? '未知'}</p>
                        <div className="flex gap-3 text-xs">
                          {idv.id_front_url && <a href={idv.id_front_url} target="_blank" className="text-primary underline">正面照片</a>}
                          {idv.id_back_url && <a href={idv.id_back_url} target="_blank" className="text-primary underline">反面照片</a>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <form action={approveId}>
                        <input type="hidden" name="practitionerId" value={idv.id} />
                        <Button type="submit" size="sm">核准</Button>
                      </form>
                      <form action={rejectId}>
                        <input type="hidden" name="practitionerId" value={idv.id} />
                        <Button type="submit" size="sm" variant="outline" className="text-destructive border-destructive hover:bg-destructive/5">退回</Button>
                      </form>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
