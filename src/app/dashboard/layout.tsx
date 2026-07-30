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
    >
      {children}
    </DashboardShell>
  )
}
