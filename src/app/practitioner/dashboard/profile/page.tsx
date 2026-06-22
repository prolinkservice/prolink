import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, CreditCard, IdCard, MapPin, Link2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SettingsLayout, type SettingsLayoutItem } from '@/components/SettingsLayout'
import { BankForm } from './bank/BankForm'
import { IdForm } from './id/IdForm'
import { AddressForm } from './address/AddressForm'
import { SocialForm } from './social/SocialForm'
import { BrandForm } from './brand/BrandForm'

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: '審核中', className: 'text-amber-600' },
  approved: { label: '已通過', className: 'text-green-600' },
  rejected: { label: '已退回', className: 'text-destructive' },
}

function statusSublabel(status: string) {
  const cfg = STATUS_LABEL[status] ?? STATUS_LABEL.pending
  return <span className={cfg.className}>{cfg.label}</span>
}

export default async function MemberProfilePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: practitioner, error: practitionerError } = await supabase
    .from('practitioners')
    .select('id, status, bank_status, id_verification_status, latitude, longitude, social_links, years_experience, certificate_name, specialty_tags, cover_image_url')
    .eq('user_id', user.id)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

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
  const specialtyTags = (practitioner.specialty_tags as string[]) ?? []
  const brandFilled = practitioner.years_experience || practitioner.certificate_name || specialtyTags.length > 0 || practitioner.cover_image_url

  const verificationChecks = [
    practitioner.bank_status === 'approved',
    practitioner.id_verification_status === 'approved',
  ]
  const approvedCount = verificationChecks.filter(Boolean).length

  const iconClass = "w-4.5 h-4.5 text-primary"
  const items: SettingsLayoutItem[] = [
    {
      key: 'brand',
      icon: <Sparkles className={iconClass} />,
      label: '個人品牌',
      sublabel: brandFilled ? <span className="text-green-600">已填寫</span> : <span className="text-amber-600">尚未填寫</span>,
      href: '/practitioner/dashboard/profile/brand',
      content: <BrandForm />,
    },
    {
      key: 'bank',
      icon: <CreditCard className={iconClass} />,
      label: '銀行帳戶',
      sublabel: statusSublabel(practitioner.bank_status),
      href: '/practitioner/dashboard/profile/bank',
      content: <BankForm />,
    },
    {
      key: 'id',
      icon: <IdCard className={iconClass} />,
      label: '身份驗證',
      sublabel: statusSublabel(practitioner.id_verification_status),
      href: '/practitioner/dashboard/profile/id',
      content: <IdForm />,
    },
    {
      key: 'address',
      icon: <MapPin className={iconClass} />,
      label: '店家地址',
      sublabel: addressVerified ? <span className="text-green-600">已驗證</span> : <span className="text-amber-600">尚未驗證</span>,
      href: '/practitioner/dashboard/profile/address',
      content: <AddressForm />,
    },
    {
      key: 'social',
      icon: <Link2 className={iconClass} />,
      label: '社群連結',
      sublabel: socialLinks.length > 0 ? `${socialLinks.length} 個連結` : '尚未新增',
      href: '/practitioner/dashboard/profile/social',
      content: <SocialForm />,
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/practitioner/dashboard">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold text-lg">會員中心</span>
      </div>

      <div className="px-4 py-6 max-w-lg lg:max-w-5xl mx-auto flex flex-col gap-5">
        <SettingsLayout
          items={items}
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
