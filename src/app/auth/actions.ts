'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { safeNextPath } from '@/lib/next-path'

// next 由表單的隱藏欄位帶進來。少了它，OAuth 回來之後
// callback 會一律導回首頁，使用者就回不到原本要去的頁面。
export async function signInWithGoogle(formData?: FormData) {
  const next = safeNextPath(formData?.get('next'))

  const supabase = await createServerSupabaseClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  })

  if (error || !data.url) {
    redirect('/auth/error')
  }

  redirect(data.url)
}

export async function signOut() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/')
}
