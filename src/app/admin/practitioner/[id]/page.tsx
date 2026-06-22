import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, MapPin, CreditCard, IdCard, Star, Award, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const SERVICE_MODE_LABEL: Record<string, string> = {
  at_shop: '到店', on_site: '到府', both: '到店 + 到府'
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  not_submitted: { label: '未上傳', className: 'text-muted-foreground bg-muted border-border' },
  pending: { label: '審核中', className: 'text-amber-600 bg-amber-50 border-amber-200' },
  approved: { label: '已通過', className: 'text-green-600 bg-green-50 border-green-200' },
  rejected: { label: '已退回', className: 'text-destructive bg-destructive/5 border-destructive/20' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABEL[status] ?? STATUS_LABEL.not_submitted
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
}

export default async function AdminPractitionerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const [{ data: practitioner }, { data: reviews }] = await Promise.all([
    supabase
      .from('practitioners')
      .select(`
        id, bio, service_mode, shop_address, status, created_at,
        bank_name, bank_account, bank_status,
        id_verification_status,
        years_experience, certificate_name, specialty_tags, cover_image_url, social_links,
        profiles ( display_name, avatar_url ),
        services ( id, name, description, duration_minutes, price )
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('reviews')
      .select('rating, comment, created_at, profiles ( display_name )')
      .eq('practitioner_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!practitioner) notFound()

  const profileRaw = practitioner.profiles as unknown
  const prof = (Array.isArray(profileRaw) ? profileRaw[0] : profileRaw) as { display_name: string | null; avatar_url: string | null } | null
  const services = (practitioner.services as { id: string; name: string; description: string | null; duration_minutes: number; price: number }[]) ?? []
  const specialtyTags = (practitioner.specialty_tags as string[]) ?? []
  const socialLinks = (practitioner.social_links as { platform: string; url: string }[]) ?? []
  const reviewList = reviews ?? []

  return (
    <div className="min-h-screen bg-[#F8F7F5]">
      <nav className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
          </Link>
          <span className="font-bold text-base text-foreground">{prof?.display_name ?? '未知'} 的詳細資料</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-5">
        <div className="bg-white rounded-2xl border border-border p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-bold text-lg text-foreground">{prof?.display_name ?? '未知'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                上架時間：{new Date(practitioner.created_at).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">已上架</Badge>
          </div>

          {practitioner.bio && (
            <div className="bg-[#F8F7F5] rounded-xl p-4 mb-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">自我介紹</p>
              <p className="text-sm text-foreground leading-relaxed">{practitioner.bio}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F8F7F5] rounded-xl p-3.5">
              <p className="text-xs font-medium text-muted-foreground mb-1">服務方式</p>
              <p className="text-sm font-semibold text-foreground">{SERVICE_MODE_LABEL[practitioner.service_mode] ?? '未設定'}</p>
            </div>
            {practitioner.shop_address && (
              <div className="bg-[#F8F7F5] rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">店面地址</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{practitioner.shop_address}</p>
              </div>
            )}
            {practitioner.years_experience != null && (
              <div className="bg-[#F8F7F5] rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Award className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">年資</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{practitioner.years_experience} 年</p>
              </div>
            )}
            {practitioner.certificate_name && (
              <div className="bg-[#F8F7F5] rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">證照</span>
                </div>
                <p className="text-sm font-semibold text-foreground">{practitioner.certificate_name}</p>
              </div>
            )}
          </div>

          {specialtyTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {specialtyTags.map((tag) => (
                <span key={tag} className="text-xs bg-accent text-primary px-2.5 py-1 rounded-full">{tag}</span>
              ))}
            </div>
          )}

          {socialLinks.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-3 text-xs">
              {socialLinks.map((link, i) => (
                <a key={i} href={link.url} target="_blank" className="text-primary underline">{link.platform}</a>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-border p-6">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-primary" />
            <p className="font-semibold text-sm text-foreground">銀行帳戶</p>
            <StatusBadge status={practitioner.bank_status} />
          </div>
          <p className="text-sm text-foreground">{practitioner.bank_name ?? '尚未填寫'}　{practitioner.bank_account}</p>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6">
          <div className="flex items-center gap-2 mb-3">
            <IdCard className="w-4 h-4 text-primary" />
            <p className="font-semibold text-sm text-foreground">身份驗證</p>
            <StatusBadge status={practitioner.id_verification_status} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6">
          <p className="font-semibold text-sm text-foreground mb-3">服務項目（{services.length}）</p>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚未新增服務項目</p>
          ) : (
            <div className="space-y-2">
              {services.map((s) => (
                <div key={s.id} className="flex items-center justify-between bg-[#F8F7F5] rounded-xl p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.duration_minutes} 分鐘</p>
                  </div>
                  <p className="text-sm font-semibold text-primary">${s.price}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-border p-6">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-primary" />
            <p className="font-semibold text-sm text-foreground">學員評價（{reviewList.length}）</p>
          </div>
          {reviewList.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無評價</p>
          ) : (
            <div className="space-y-3">
              {reviewList.map((r, i) => {
                const reviewerRaw = r.profiles as unknown
                const reviewer = (Array.isArray(reviewerRaw) ? reviewerRaw[0] : reviewerRaw) as { display_name: string | null } | null
                return (
                  <div key={i} className="bg-[#F8F7F5] rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-foreground">{reviewer?.display_name ?? '匿名'}</p>
                      <span className="text-xs text-amber-500">{'★'.repeat(r.rating)}</span>
                    </div>
                    {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
