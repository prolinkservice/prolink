import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, User, CreditCard, Lock, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SettingsLayout, type SettingsLayoutItem } from '@/components/SettingsLayout'
import { ProfileForm } from './profile/ProfileForm'
import { PaymentHistory } from './payment/PaymentHistory'
import { PasswordForm } from './password/PasswordForm'
import { LineLinkSection } from './line/LineLinkSection'
import { BrandMark } from '@/components/BrandMark'

export default async function AccountPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, role')
    .eq('id', user.id)
    .single()

  const hasPasswordLogin = user.identities?.some(i => i.provider === 'email') ?? false

  const iconClass = "w-4.5 h-4.5 text-primary"
  const items: SettingsLayoutItem[] = [
    {
      key: 'profile',
      icon: <User className={iconClass} />,
      label: '個人檔案',
      href: '/account/profile',
      content: <ProfileForm />,
    },
    {
      key: 'payment',
      icon: <CreditCard className={iconClass} />,
      label: '付款紀錄',
      sublabel: '查看歷史預約付款狀態',
      href: '/account/payment',
      content: <PaymentHistory />,
    },
    {
      key: 'line',
      icon: <MessageCircle className={iconClass} />,
      label: 'LINE 通知綁定',
      sublabel: '可接收預約 LINE 通知',
      href: '/account/line',
      content: <LineLinkSection />,
    },
  ]

  if (hasPasswordLogin) {
    items.push({
      key: 'password',
      icon: <Lock className={iconClass} />,
      label: '更改密碼',
      href: '/account/password',
      content: <PasswordForm />,
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold text-lg">我的帳戶</span>
      <BrandMark />
      </div>

      <div className="px-4 py-6 max-w-lg lg:max-w-5xl mx-auto flex flex-col gap-5">
        <div className="lg:hidden flex items-center gap-4 px-2">
          <Avatar size="lg">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-accent text-foreground text-lg font-semibold">
              {profile?.display_name?.[0] ?? user.email?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-lg text-foreground">{profile?.display_name ?? '會員'}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <SettingsLayout
          items={items}
          header={
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-accent text-foreground text-lg font-semibold">
                  {profile?.display_name?.[0] ?? user.email?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{profile?.display_name ?? '會員'}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          }
        />

        {!hasPasswordLogin && (
          <p className="text-xs text-muted-foreground text-center px-4">
            你使用 Google 帳號登入，密碼由 Google 管理
          </p>
        )}
      </div>
    </div>
  )
}
