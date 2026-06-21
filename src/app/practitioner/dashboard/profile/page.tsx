import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, CreditCard, IdCard, MapPin, Link2, AtSign, Share2, Globe, Plus, X, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { updateBankAccount, updateIdVerification, revalidateAddress, addSocialLink, removeSocialLink } from './actions'

const STATUS_CONFIG: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  pending: { label: '審核中', className: 'text-amber-600 bg-amber-50 border-amber-200', Icon: Clock },
  approved: { label: '已通過', className: 'text-green-600 bg-green-50 border-green-200', Icon: CheckCircle2 },
  rejected: { label: '已退回', className: 'text-destructive bg-destructive/5 border-destructive/20', Icon: XCircle },
}

const PLATFORM_ICON: Record<string, typeof Globe> = {
  instagram: AtSign,
  facebook: Share2,
  line: Link2,
  other: Globe,
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

export default async function MemberProfilePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('id, status, bank_name, bank_account, bank_status, id_front_url, id_back_url, id_verification_status, shop_address, latitude, longitude, social_links')
    .eq('user_id', user.id)
    .single()

  if (!practitioner || practitioner.status !== 'approved') redirect('/')

  const socialLinks = (practitioner.social_links as { platform: string; url: string }[]) ?? []
  const addressVerified = practitioner.latitude !== null && practitioner.longitude !== null

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/practitioner/dashboard">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold text-lg">會員中心</span>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto flex flex-col gap-5">

        {/* 銀行帳戶 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              銀行帳戶
            </CardTitle>
            <StatusBadge status={practitioner.bank_status} />
          </CardHeader>
          <CardContent>
            <form action={updateBankAccount} className="flex flex-col gap-3">
              <div>
                <Label>銀行名稱</Label>
                <Input name="bankName" defaultValue={practitioner.bank_name ?? ''} placeholder="例：台灣銀行" className="mt-1" />
              </div>
              <div>
                <Label>銀行帳號</Label>
                <Input name="bankAccount" defaultValue={practitioner.bank_account ?? ''} placeholder="請輸入帳號" className="mt-1" />
              </div>
              <Button type="submit" size="sm" className="self-start active:scale-95 transition-transform">
                儲存並送審
              </Button>
              <p className="text-xs text-muted-foreground">修改後將重新進入審核狀態</p>
            </form>
          </CardContent>
        </Card>

        {/* 身份驗證 */}
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

        {/* 店家地址 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              店家地址
            </CardTitle>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${
              addressVerified ? 'text-green-600 bg-green-50 border-green-200' : 'text-amber-600 bg-amber-50 border-amber-200'
            }`}>
              {addressVerified ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {addressVerified ? '已驗證' : '尚未驗證'}
            </span>
          </CardHeader>
          <CardContent>
            <form action={revalidateAddress} className="flex flex-col gap-3">
              <Input name="shopAddress" defaultValue={practitioner.shop_address ?? ''} placeholder="請輸入完整地址" />
              <Button type="submit" size="sm" className="self-start active:scale-95 transition-transform">
                更新並重新驗證
              </Button>
              <p className="text-xs text-muted-foreground">系統會自動將地址轉換為地圖座標</p>
            </form>
          </CardContent>
        </Card>

        {/* 社群連結 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="w-4 h-4 text-primary" />
              社群帳號連結
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {socialLinks.length > 0 && (
              <div className="flex flex-col gap-2">
                {socialLinks.map((link, i) => {
                  const Icon = PLATFORM_ICON[link.platform] ?? Globe
                  return (
                    <div key={i} className="flex items-center gap-3 bg-muted/40 rounded-xl px-3 py-2.5">
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 hover:bg-primary hover:text-white transition-colors active:scale-90">
                        <Icon className="w-4 h-4 text-primary group-hover:text-white" />
                      </a>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary truncate flex-1 underline-offset-2 hover:underline">
                        {link.url}
                      </a>
                      <form action={removeSocialLink}>
                        <input type="hidden" name="index" value={i} />
                        <button type="submit" className="text-muted-foreground hover:text-destructive active:scale-90 transition-transform">
                          <X className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
                  )
                })}
              </div>
            )}

            <form action={addSocialLink} className="flex flex-col gap-2 pt-1">
              <div className="flex gap-2">
                <select name="platform" className="border border-input rounded-md px-3 py-2 text-sm bg-background" defaultValue="instagram">
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="line">LINE</option>
                  <option value="other">其他</option>
                </select>
                <Input name="url" placeholder="https://..." required className="flex-1" />
              </div>
              <Button type="submit" size="sm" variant="outline" className="self-start active:scale-95 transition-transform">
                <Plus className="w-3.5 h-3.5 mr-1" />
                新增連結
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
