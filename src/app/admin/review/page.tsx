import { Badge } from '@/components/ui/badge'
import { approvePractitioner, rejectPractitioner, approveBank, rejectBank, approveId, rejectId } from '../actions'
import { Button } from '@/components/ui/button'
import { CheckCircle2, MapPin, CreditCard, FileText, Store, IdCard } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { AdminReviewLayout, type AdminReviewItem } from '../AdminReviewLayout'

const SERVICE_MODE_LABEL: Record<string, string> = {
  at_shop: '到店', on_site: '到府', both: '到店 + 到府'
}

export default async function AdminReviewPage() {
  const supabase = await createServerSupabaseClient()

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
          const [passbookSigned, idFrontSigned, idBackSigned] = await Promise.all([
            r.passbook_url ? supabase.storage.from('verification-docs').createSignedUrl(r.passbook_url, 60 * 10) : Promise.resolve({ data: null }),
            r.id_front_url ? supabase.storage.from('verification-docs').createSignedUrl(r.id_front_url, 60 * 10) : Promise.resolve({ data: null }),
            r.id_back_url ? supabase.storage.from('verification-docs').createSignedUrl(r.id_back_url, 60 * 10) : Promise.resolve({ data: null }),
          ])
          return {
            ...r,
            passbookSignedUrl: passbookSigned.data?.signedUrl ?? null,
            idFrontSignedUrl: idFrontSigned.data?.signedUrl ?? null,
            idBackSignedUrl: idBackSigned.data?.signedUrl ?? null,
          }
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
              <div className="flex gap-3 mt-3">
                <form action={approveBank}>
                  <input type="hidden" name="practitionerId" value={r.id} />
                  <Button type="submit" size="sm">核准</Button>
                </form>
                <form action={rejectBank} className="flex-1 space-y-2">
                  <textarea
                    name="reason"
                    placeholder="請填寫退回原因（將顯示給職人）"
                    required
                    className="w-full bg-white border border-border rounded-xl px-3 py-2 text-sm resize-none min-h-[44px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
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
              <div className="flex gap-3">
                <form action={approveId}>
                  <input type="hidden" name="practitionerId" value={r.id} />
                  <Button type="submit" size="sm">核准</Button>
                </form>
                <form action={rejectId} className="flex-1 space-y-2">
                  <textarea
                    name="reason"
                    placeholder="請填寫退回原因（將顯示給職人）"
                    required
                    className="w-full bg-white border border-border rounded-xl px-3 py-2 text-sm resize-none min-h-[44px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
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
    <div className="space-y-4">
      {reviewError && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 text-sm text-destructive">
          查詢錯誤：{reviewError.message}
        </div>
      )}
      <div className="flex items-center gap-3">
        <h1 className="font-bold text-xl text-foreground">待審核</h1>
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
    </div>
  )
}
