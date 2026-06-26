'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBrowserSupabaseClient } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()

  const [checking, setChecking] = useState(true)
  const [validSession, setValidSession] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setValidSession(!!user)
      setChecking(false)
    })
  }, [])

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

      setSuccess('密碼已重新設定，正在前往首頁...')
      setTimeout(() => router.push('/'), 1200)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '設定失敗，請再試一次')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">載入中...</div>
  }

  if (!validSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center gap-4">
        <h1 className="text-xl font-bold">連結已失效</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          這個重設密碼連結已經過期或已使用過，請重新申請一次
        </p>
        <Button asChild>
          <a href="/auth/forgot-password">重新申請</a>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-2">設定新密碼</h1>
      <p className="text-muted-foreground text-sm mb-6">請輸入你的新密碼</p>

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
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">{success}</p>}

        <Button type="submit" size="lg" disabled={loading} className="mt-2 active:scale-95 transition-transform">
          {loading ? '設定中...' : '設定新密碼'}
        </Button>
      </form>
    </div>
  )
}
