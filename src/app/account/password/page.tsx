'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBrowserSupabaseClient } from '@/lib/supabase'

export default function AccountPasswordPage() {
  const router = useRouter()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const hasPasswordLogin = user.identities?.some(i => i.provider === 'email') ?? false
      if (!hasPasswordLogin) { router.push('/account'); return }
      setChecking(false)
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword.length < 6) {
      setError('密碼至少需要 6 個字元')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('兩次密碼輸入不一致')
      return
    }

    setLoading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError

      setSuccess('密碼已更新')
      setTimeout(() => router.push('/account'), 800)
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">載入中...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/account">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold text-lg">更改密碼</span>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="newPassword">新密碼</Label>
            <Input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="至少 6 個字元"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">確認新密碼</Label>
            <Input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1"
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}

          <Button type="submit" size="lg" disabled={loading} className="mt-2 active:scale-95 transition-transform">
            {loading ? '更新中...' : '更新密碼'}
          </Button>
        </form>
      </div>
    </div>
  )
}
