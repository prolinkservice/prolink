import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentTenant } from '@/lib/tenant'
import { OnboardingWizard } from './OnboardingWizard'

export const metadata: Metadata = {
  title: '建立你的工作室 · 職人連結',
}

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 導向 /auth 而非 /login：/login 只有帳密欄位，
  // 用 Google 或 LINE 註冊的人到那裡沒有密碼可填，會直接卡死
  if (!user) redirect('/auth?next=/onboarding')

  // 已經有工作室的人不需要再跑一次精靈
  const existing = await getCurrentTenant()
  if (existing) redirect('/practitioner/dashboard')

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://prolink.tw'

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <OnboardingWizard siteUrl={siteUrl} userEmail={user.email ?? '（未提供信箱）'} />
    </main>
  )
}
