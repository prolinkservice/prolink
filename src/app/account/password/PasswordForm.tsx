'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBrowserSupabaseClient } from '@/lib/supabase'

export function PasswordForm({ onSaved }: { onSaved?: () => void }) {
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
      if (onSaved) {
        onSaved()
      } else {
        setTimeout(() => router.push('/account'), 800)
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return <div className="py-8 text-center text-muted-foreground text-sm">載入中...</div>
  }

  return (
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
  )
}
