import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { approvePractitioner, rejectPractitioner } from './actions'
import { signOut } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: pending } = await supabase
    .from('practitioners')
    .select(`
      id, bio, service_mode, shop_address, license_url, bank_name, bank_account, created_at,
      profiles ( display_name )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const { data: approved } = await supabase
    .from('practitioners')
    .select('id, profiles ( display_name ), created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(10)

  const SERVICE_MODE_LABEL: Record<string, string> = {
    at_shop: '到店', on_site: '到府', both: '兩者皆提供'
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
        <span className="font-bold text-lg">ProLink 管理後台</span>
        <form action={signOut}>
          <Button variant="ghost" size="sm" type="submit"><LogOut className="w-4 h-4" /></Button>
        </form>
      </nav>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">
        {/* 待審核 */}
        <section>
          <h2 className="font-bold text-lg mb-3">
            待審核職人
            <Badge className="ml-2" variant="default">{pending?.length ?? 0}</Badge>
          </h2>

          {!pending || pending.length === 0 ? (
            <p className="text-muted-foreground text-sm">目前沒有待審核的申請</p>
          ) : (
            <div className="space-y-4">
              {pending.map(p => {
                const profileRaw = p.profiles as unknown
                const prof = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { display_name: string | null } | null
                return (
                  <Card key={p.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold">{prof?.display_name ?? '未知'}</p>
                          <p className="text-xs text-muted-foreground">
                            申請時間：{new Date(p.created_at).toLocaleString('zh-TW')}
                          </p>
                        </div>
                        <Badge variant="outline">待審核</Badge>
                      </div>

                      <div className="text-sm space-y-1 mb-4 text-muted-foreground">
                        <p><span className="text-foreground font-medium">服務方式：</span>{SERVICE_MODE_LABEL[p.service_mode]}</p>
                        {p.shop_address && <p><span className="text-foreground font-medium">地址：</span>{p.shop_address}</p>}
                        {p.bio && <p><span className="text-foreground font-medium">自介：</span>{p.bio}</p>}
                        {p.license_url && (
                          <p><span className="text-foreground font-medium">證照：</span>
                            <a href={p.license_url} target="_blank" className="text-primary underline">查看</a>
                          </p>
                        )}
                        {p.bank_name && <p><span className="text-foreground font-medium">銀行：</span>{p.bank_name} {p.bank_account}</p>}
                      </div>

                      <div className="flex gap-2">
                        <form action={approvePractitioner}>
                          <input type="hidden" name="practitionerId" value={p.id} />
                          <Button type="submit" size="sm">核准上架</Button>
                        </form>
                        <form action={rejectPractitioner}>
                          <input type="hidden" name="practitionerId" value={p.id} />
                          <Button type="submit" size="sm" variant="outline" className="text-destructive border-destructive hover:bg-destructive/10">退回</Button>
                        </form>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        {/* 已上架 */}
        <section>
          <h2 className="font-bold text-lg mb-3">已上架職人（最新 10 筆）</h2>
          {!approved || approved.length === 0 ? (
            <p className="text-muted-foreground text-sm">尚無已上架職人</p>
          ) : (
            <div className="space-y-2">
              {approved.map(p => {
                const profileRaw = p.profiles as unknown
                const prof = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { display_name: string | null } | null
                return (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm">{prof?.display_name ?? '未知'}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString('zh-TW')}
                    </span>
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
