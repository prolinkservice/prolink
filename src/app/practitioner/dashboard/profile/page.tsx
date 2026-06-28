import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ShieldCheck, MapPin, Link2, Rows3, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SettingsLayout, type SettingsLayoutItem } from '@/components/SettingsLayout'
import { VerificationForm } from './verification/VerificationForm'
import { AddressForm } from './address/AddressForm'
import { ServiceModeForm } from './address/ServiceModeForm'
import { SocialForm } from './social/SocialForm'
import { LayoutBuilderForm } from './layout-builder/LayoutBuilderForm'
import { LineLinkSection } from '@/app/account/line/LineLinkSection'
import { FollowupMessageForm } from './followup/FollowupMessageForm'
import { BrandMark } from '@/components/BrandMark'

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  not_submitted: { label: '未上傳', className: 'text-muted-foreground' },
  pending: { label: '審核中', className: 'text-amber-600' },
  approved: { label: '已通過', className: 'text-green-600' },
  rejected: { label: '已退回', className: 'text-destructive' },
}

function statusSublabel(status: string) {
  const cfg = STATUS_LABEL[status] ?? STATUS_LABEL.not_submitted
  return <span className={cfg.className}>{cfg.label}</span>
}

export default async function MemberProfilePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [
    { data: practitioner, error: practitionerError },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from('practitioners')
      .select('id, status, bank_status, id_verification_status, latitude, longitude, social_links, years_experience, certificates, specialty_tags, cover_image_url')
      .eq('user_id', user.id)
      .single(),
    supabase.from('profiles').select('display_name').eq('id', user.id).single(),
  ])

  if (practitionerError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 text-sm text-destructive max-w-md">
          查詢錯誤：{practitionerError.message}
        </div>
      </div>
    )
  }

  if (!practitioner || practitioner.status !== 'approved') redirect('/')

  const socialLinks = (practitioner.social_links as { platform: string; url: string }[]) ?? []
  const addressVerified = practitioner.latitude !== null && practitioner.longitude !== null

  const verificationChecks = [
    practitioner.bank_status === 'approved',
    practitioner.id_verification_status === 'approved',
  ]
  const approvedCount = verificationChecks.filter(Boolean).length

  const iconClass = "w-4.5 h-4.5 text-primary"
  const items: SettingsLayoutItem[] = [
    {
      key: 'verification',
      icon: <ShieldCheck className={iconClass} />,
      label: '身份與收款資料',
      sublabel: (
        <span className="flex gap-2">
          <span>銀行：{statusSublabel(practitioner.bank_status)}</span>
          <span>身份：{statusSublabel(practitioner.id_verification_status)}</span>
        </span>
      ),
      href: '/practitioner/dashboard/profile/verification',
      content: <VerificationForm />,
    },
    {
      key: 'address',
      icon: <MapPin className={iconClass} />,
      label: '服務方式 / 店家地址',
      sublabel: addressVerified ? <span className="text-green-600">已驗證</span> : <span className="text-amber-600">尚未驗證</span>,
      href: '/practitioner/dashboard/profile/address',
      content: <div className="flex flex-col gap-5"><ServiceModeForm /><AddressForm /></div>,
    },
    {
      key: 'social',
      icon: <Link2 className={iconClass} />,
      label: '社群連結',
      sublabel: socialLinks.length > 0 ? `${socialLinks.length} 個連結` : '尚未新增',
      href: '/practitioner/dashboard/profile/social',
      content: <SocialForm />,
    },
    {
      key: 'layout-builder',
      icon: <Rows3 className={iconClass} />,
      label: '首頁編排',
      sublabel: '自訂老師頁面排版',
      href: '/practitioner/dashboard/profile/layout-builder',
      content: <LayoutBuilderForm />,
    },
    {
      key: 'line',
      icon: <MessageCircle className={iconClass} />,
      label: 'LINE 通知綁定',
      sublabel: '接收新預約 LINE 通知',
      href: '/practitioner/dashboard/profile/line',
      content: <LineLinkSection next="/practitioner/dashboard/profile/line" />,
    },
    {
      key: 'followup',
      icon: <MessageCircle className={iconClass} />,
      label: '完成後問候訊息',
      sublabel: '預約完成24小時後自動發送',
      href: '/practitioner/dashboard/profile/followup',
      content: <FollowupMessageForm />,
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="lg:hidden sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/practitioner/dashboard">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold text-lg">會員中心</span>
      <BrandMark />
      </div>

      <div className="px-4 py-6 max-w-lg lg:max-w-5xl mx-auto flex flex-col gap-5">
        <SettingsLayout
          items={items}
          direction="horizontal"
          header={
            <div>
              <p className="font-semibold text-foreground truncate">{profile?.display_name ?? '會員中心'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {approvedCount}/{verificationChecks.length} 項目已通過審核
              </p>
            </div>
          }
        />
      </div>
    </div>
  )
}
