'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, Upload, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { updateBrandInfo, updateAvatar } from '../actions'
import { updateDisplayName } from '@/lib/profile-actions'

const NAME_CHANGE_COOLDOWN_DAYS = 7

export interface CertificateEntry {
  name: string
  year: number | null
}

interface BrandData {
  years_experience: number | null
  certificates: CertificateEntry[] | null
  specialty_tags: string[] | null
  cover_image_url: string | null
}

export function BrandForm() {
  const [data, setData] = useState<BrandData | null>(null)
  const [loading, setLoading] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [nextEditableAt, setNextEditableAt] = useState<Date | null>(null)
  const [nameSaving, setNameSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [nameSuccess, setNameSuccess] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [certificates, setCertificates] = useState<CertificateEntry[]>([])

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: practitioner } = await supabase
        .from('practitioners')
        .select('years_experience, certificates, specialty_tags, cover_image_url')
        .eq('user_id', user.id)
        .single()
      setData(practitioner as BrandData)
      const certs = (practitioner?.certificates as CertificateEntry[]) ?? []
      setCertificates(certs.length > 0 ? certs : [{ name: '', year: null }])

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, display_name_updated_at')
        .eq('id', user.id)
        .single()
      setAvatarUrl(profile?.avatar_url ?? null)
      setDisplayName(profile?.display_name ?? null)
      setNameInput(profile?.display_name ?? '')
      if (profile?.display_name_updated_at) {
        const next = new Date(profile.display_name_updated_at)
        next.setDate(next.getDate() + NAME_CHANGE_COOLDOWN_DAYS)
        setNextEditableAt(next > new Date() ? next : null)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    setAvatarError(null)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('尚未登入')

      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`

      const formData = new FormData()
      formData.set('avatarUrl', publicUrl)
      await updateAvatar(formData)

      setAvatarUrl(publicUrl)
    } catch (err) {
      console.error(err)
      setAvatarError('上傳失敗，請再試一次')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleNameSave() {
    setNameSaving(true)
    setNameError(null)
    setNameSuccess(false)
    try {
      const formData = new FormData()
      formData.set('displayName', nameInput)
      const result = await updateDisplayName(formData)
      if (result?.error) {
        setNameError(result.error)
      } else {
        setDisplayName(nameInput)
        setNameSuccess(true)
        const next = new Date()
        next.setDate(next.getDate() + NAME_CHANGE_COOLDOWN_DAYS)
        setNextEditableAt(next)
      }
    } finally {
      setNameSaving(false)
    }
  }

  function updateCertificate(i: number, field: keyof CertificateEntry, value: string) {
    setCertificates(prev => prev.map((c, idx) => {
      if (idx !== i) return c
      if (field === 'year') {
        return { ...c, year: value ? parseInt(value) : null }
      }
      return { ...c, name: value }
    }))
  }

  function addCertificate() {
    setCertificates(prev => [...prev, { name: '', year: null }])
  }

  function removeCertificate(i: number) {
    setCertificates(prev => prev.filter((_, idx) => idx !== i))
  }

  if (loading || !data) {
    return <p className="text-muted-foreground text-sm text-center py-8">載入中...</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            大頭照
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback className="bg-accent text-foreground text-xl font-semibold">
              {displayName?.[0] ?? '老'}
            </AvatarFallback>
          </Avatar>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingAvatar}
              onClick={() => avatarInputRef.current?.click()}
              className="active:scale-95 transition-transform"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              {uploadingAvatar ? '上傳中...' : '更換大頭照'}
            </Button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleAvatarChange}
              className="hidden"
            />
            {avatarError && <p className="text-xs text-destructive mt-1.5">{avatarError}</p>}
            <p className="text-xs text-muted-foreground mt-1.5">會顯示在首頁與老師詳細頁</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            姓名
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Label>顯示名稱</Label>
          <Input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="請輸入姓名"
            className="mt-1"
            disabled={!!nextEditableAt}
          />
          {nextEditableAt ? (
            <p className="text-xs text-muted-foreground mt-1.5">
              姓名七天內只能修改一次，下次可修改時間：{nextEditableAt.toLocaleDateString('zh-TW')}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1.5">每七天只能修改一次，請確認後再儲存</p>
          )}
          {nameError && <p className="text-xs text-destructive mt-1.5">{nameError}</p>}
          {nameSuccess && <p className="text-xs text-green-600 mt-1.5">已更新姓名</p>}
          <Button
            type="button"
            size="sm"
            className="mt-3 active:scale-95 transition-transform"
            disabled={nameSaving || !!nextEditableAt || nameInput === displayName}
            onClick={handleNameSave}
          >
            {nameSaving ? '儲存中...' : '儲存'}
          </Button>
        </CardContent>
      </Card>

      <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          個人品牌
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={updateBrandInfo} className="flex flex-col gap-3">
          <div>
            <Label>執業年資</Label>
            <Input type="number" name="yearsExperience" defaultValue={data.years_experience ?? ''} placeholder="例：5" className="mt-1" min={0} />
          </div>
          <div>
            <Label>經歷／相關證照</Label>
            <div className="flex flex-col gap-2 mt-1">
              {certificates.map((cert, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Input
                    value={cert.name}
                    onChange={e => updateCertificate(i, 'name', e.target.value)}
                    placeholder="例：中醫推拿執照"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={cert.year ?? ''}
                    onChange={e => updateCertificate(i, 'year', e.target.value)}
                    placeholder="年份（選填）"
                    className="w-32"
                  />
                  {certificates.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCertificate(i)}
                      className="text-destructive hover:opacity-70 active:scale-90 transition-transform shrink-0 mt-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addCertificate} className="self-start active:scale-95 transition-transform">
                <Plus className="w-3 h-3 mr-1" />新增一筆
              </Button>
            </div>
            <input type="hidden" name="certificates" value={JSON.stringify(certificates.filter(c => c.name.trim()))} />
          </div>
          <div>
            <Label>專長標籤（用逗號分隔）</Label>
            <Input name="specialtyTags" defaultValue={(data.specialty_tags ?? []).join(', ')} placeholder="例：運動按摩, 深層組織按摩, 久坐族群調理" className="mt-1" />
          </div>
          <div>
            <Label>封面照網址</Label>
            <Input name="coverImageUrl" defaultValue={data.cover_image_url ?? ''} placeholder="https://..." className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">建議使用寬幅橫向照片，Demo 階段請貼上圖片連結</p>
          </div>
          <Button type="submit" size="sm" className="self-start active:scale-95 transition-transform">
            儲存
          </Button>
        </form>
      </CardContent>
      </Card>
    </div>
  )
}
