import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, User, CreditCard, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SettingsListGroup, SettingsListItem } from '@/components/SettingsListItem'

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

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold text-lg">我的帳戶</span>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto flex flex-col gap-5">
        <div className="flex items-center gap-4 px-2">
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

        <SettingsListGroup>
          <SettingsListItem icon={User} label="個人檔案" href="/account/profile" />
          <SettingsListItem icon={CreditCard} label="付款方式" sublabel="尚未設定" href="/account/payment" />
          {hasPasswordLogin && (
            <SettingsListItem icon={Lock} label="更改密碼" href="/account/password" />
          )}
        </SettingsListGroup>

        {!hasPasswordLogin && (
          <p className="text-xs text-muted-foreground text-center px-4">
            你使用 Google 帳號登入，密碼由 Google 管理
          </p>
        )}
      </div>
    </div>
  )
}
