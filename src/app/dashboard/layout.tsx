import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentTenant } from '@/lib/tenant'
import { THEME_COOKIE, type Theme } from '@/components/ThemeToggle'
import { DashboardShell } from './DashboardShell'

// 外框的樣子在 DashboardShell（客戶端），這裡只管認人與取資料。
// 草稿：docs/mockups/dashboard-shell-v2.html

const ROLE_LABEL: Record<string, string> = {
  owner: '擁有者',
  manager: '管理者',
  staff: '服務人員',
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // 同 /onboarding：/login 只有帳密，OAuth 註冊的人會卡住
  if (!user) redirect('/auth?next=/dashboard')

  const current = await getCurrentTenant()
  if (!current) redirect('/onboarding')

  const { tenant, member } = current

  // 測試模式開著的時候，每一頁都要看得到。這是唯一一個
  // 「開著的時候所有東西看起來都壞掉」的設定——藏在 LINE 設定頁裡
  // 一定會被忘記，然後花一小時 debug 一個根本沒壞的系統
  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('test_mode')
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://prolink.tw').replace(/\/$/, '')
  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value
  const theme: Theme =
    themeCookie === 'light' || themeCookie === 'dark' ? themeCookie : 'auto'

  return (
    <DashboardShell
      tenantName={tenant.name}
      roleLabel={`${member.display_name} · ${ROLE_LABEL[member.role] ?? member.role}`}
      slug={tenant.slug}
      bookingUrl={`${siteUrl}/p/${tenant.slug}`}
      theme={theme}
      testMode={settings?.test_mode ?? false}
    >
      {children}
    </DashboardShell>
  )
}
