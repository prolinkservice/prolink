'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { BrandMark } from '@/components/BrandMark'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
      })
      if (resetError) throw resetError
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '寄送失敗，請再試一次')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-xl font-bold">請確認你的信箱</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          我們已寄出一封重設密碼信到 {email}，請點擊信中的連結設定新密碼
        </p>
        <Button asChild variant="outline">
          <Link href="/auth?mode=login">回登入頁</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/auth?mode=login">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <h1 className="text-xl font-bold">忘記密碼</h1>
      <BrandMark />
      </div>

      <p className="text-muted-foreground text-sm mb-6">
        輸入註冊時使用的 Email，我們會寄送重設密碼的連結給你
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button type="submit" size="lg" disabled={loading} className="mt-2 active:scale-95 transition-transform">
          {loading ? '寄送中...' : '寄送重設密碼信'}
        </Button>
      </form>
    </div>
  )
}
