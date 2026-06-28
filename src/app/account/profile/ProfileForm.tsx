'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { updateDisplayName, updateDemographics } from '@/lib/profile-actions'

const NAME_CHANGE_COOLDOWN_DAYS = 7

export function ProfileForm({ onSaved }: { onSaved?: () => void }) {
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [gender, setGender] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [nextEditableAt, setNextEditableAt] = useState<Date | null>(null)
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
        .select('display_name, display_name_updated_at, gender, birthdate')
        .eq('id', user.id)
        .single()

      setDisplayName(profile?.display_name ?? '')
      setGender(profile?.gender ?? '')
      setBirthdate(profile?.birthdate ?? '')
      if (profile?.display_name_updated_at) {
        const next = new Date(profile.display_name_updated_at)
        next.setDate(next.getDate() + NAME_CHANGE_COOLDOWN_DAYS)
        setNextEditableAt(next > new Date() ? next : null)
      }
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
      if (!nextEditableAt) {
        const formData = new FormData()
        formData.set('displayName', displayName)
        const result = await updateDisplayName(formData)
        if (result?.error) {
          setError(result.error)
          return
        }
        const next = new Date()
        next.setDate(next.getDate() + NAME_CHANGE_COOLDOWN_DAYS)
        setNextEditableAt(next)
      }

      const demoFormData = new FormData()
      demoFormData.set('gender', gender)
      demoFormData.set('birthdate', birthdate)
      await updateDemographics(demoFormData)

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
          disabled={!!nextEditableAt}
        />
        {nextEditableAt && (
          <p className="text-xs text-muted-foreground mt-1.5">
            姓名七天內只能修改一次，下次可修改時間：{nextEditableAt.toLocaleDateString('zh-TW')}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled className="mt-1" />
      </div>

      <div className="border-t border-border mt-2 pt-4 flex flex-col gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">個人資料（選填）</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            填寫後有助於平台了解使用者輪廓、優化服務，不影響預約功能，可隨時修改或留空
          </p>
        </div>
        <div>
          <Label htmlFor="gender">性別</Label>
          <select
            id="gender"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">不透露</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
            <option value="other">其他</option>
          </select>
        </div>
        <div>
          <Label htmlFor="birthdate">生日</Label>
          <Input
            id="birthdate"
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {success && <p className="text-green-600 text-sm">{success}</p>}

      <Button type="submit" size="lg" disabled={saving} className="mt-2 active:scale-95 transition-transform">
        {saving ? '儲存中...' : '儲存'}
      </Button>
    </form>
  )
}
