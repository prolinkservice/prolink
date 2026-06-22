import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, CreditCard, IdCard, MapPin, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SettingsLayout, type SettingsLayoutItem } from '@/components/SettingsLayout'
import { BankForm } from './bank/BankForm'
import { IdForm } from './id/IdForm'
import { AddressForm } from './address/AddressForm'
import { SocialForm } from './social/SocialForm'

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

  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('id, status, bank_status, id_verification_status, latitude, longitude, social_links')
    .eq('user_id', user.id)
    .single()

  if (!practitioner || practitioner.status !== 'approved') redirect('/')

  const socialLinks = (practitioner.social_links as { platform: string; url: string }[]) ?? []
  const addressVerified = practitioner.latitude !== null && practitioner.longitude !== null

  const items: SettingsLayoutItem[] = [
    {
      key: 'bank',
      icon: CreditCard,
      label: '銀行帳戶',
      sublabel: statusSublabel(practitioner.bank_status),
      href: '/practitioner/dashboard/profile/bank',
      content: <BankForm />,
    },
    {
      key: 'id',
      icon: IdCard,
      label: '身份驗證',
      sublabel: statusSublabel(practitioner.id_verification_status),
      href: '/practitioner/dashboard/profile/id',
      content: <IdForm />,
    },
    {
      key: 'address',
      icon: MapPin,
      label: '店家地址',
      sublabel: addressVerified ? <span className="text-green-600">已驗證</span> : <span className="text-amber-600">尚未驗證</span>,
      href: '/practitioner/dashboard/profile/address',
      content: <AddressForm />,
    },
    {
      key: 'social',
      icon: Link2,
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

      <div className="px-4 py-6 max-w-lg lg:max-w-4xl mx-auto flex flex-col gap-5">
        <SettingsLayout items={items} />
      </div>
    </div>
  )
}
