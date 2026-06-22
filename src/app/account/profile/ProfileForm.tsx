'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBrowserSupabaseClient } from '@/lib/supabase'

export function ProfileForm({ onSaved }: { onSaved?: () => void }) {
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUserId(user.id)
      setEmail(user.email ?? '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()

      setDisplayName(profile?.display_name ?? '')
      setLoading(false)
    }
    load()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!userId) return

    setSaving(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', userId)

      if (updateError) throw updateError

      setSuccess('已更新個人檔案')
      if (onSaved) {
        onSaved()
      } else {
        setTimeout(() => router.push('/account'), 800)
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm text-center py-8">載入中...</p>
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="displayName">姓名</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="請輸入姓名"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled className="mt-1" />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {success && <p className="text-green-600 text-sm">{success}</p>}

      <Button type="submit" size="lg" disabled={saving} className="mt-2 active:scale-95 transition-transform">
        {saving ? '儲存中...' : '儲存'}
      </Button>
    </form>
  )
}
