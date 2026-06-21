'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBrowserSupabaseClient } from '@/lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('兩次密碼輸入不一致')
      return
    }
    if (password.length < 6) {
      setError('密碼至少需要 6 個字元')
      return
    }

    setLoading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })

      if (signUpError) throw signUpError

      if (data.session) {
        router.push(next)
      } else {
        router.push('/auth/check-email')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '註冊失敗，請再試一次')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <h1 className="text-xl font-bold">會員註冊</h1>
      </div>

      <p className="text-muted-foreground text-sm mb-6">
        註冊成為 ProLink 會員，立即預約老師服務
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
        <div>
          <Label htmlFor="password">密碼</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 6 個字元"
          />
        </div>
        <div>
          <Label htmlFor="confirmPassword">確認密碼</Label>
          <Input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button type="submit" size="lg" disabled={loading} className="mt-2 active:scale-95 transition-transform">
          {loading ? '註冊中...' : '註冊'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        已經有帳號？
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-primary font-medium ml-1">直接登入</Link>
      </p>
    </div>
  )
}
