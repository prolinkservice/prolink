'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, Upload, Plus, Trash2, Link2, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { updateBrandInfo, updateAvatar, updateCoverImage, updateSlug } from '../actions'
import { updateDisplayName } from '@/lib/profile-actions'
import { slugifySuggestion } from '@/lib/slug'

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
  cover_image_position: string | null
  brand_color: string | null
}

const PRESET_COLORS = [
  { label: '抹茶森林綠（預設）', value: '#4A7C59' },
  { label: '暖杏橙', value: '#D98E4A' },
  { label: '珊瑚紅', value: '#E0735D' },
  { label: '霧藍', value: '#5A7D9A' },
  { label: '紫丁香', value: '#8B6FA8' },
]

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
  const [brandColor, setBrandColor] = useState('#4A7C59')
  const [yearsExperienceInput, setYearsExperienceInput] = useState('')
  const [specialtyTagsInput, setSpecialtyTagsInput] = useState('')
  const [brandInfoSaving, setBrandInfoSaving] = useState(false)
  const [brandInfoSuccess, setBrandInfoSuccess] = useState(false)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [coverPosition, setCoverPosition] = useState('50% 50%')
  const [uploadingCover, setUploadingCover] = useState(false)
  const [coverError, setCoverError] = useState<string | null>(null)
  const [coverSaving, setCoverSaving] = useState(false)
  const [coverSuccess, setCoverSuccess] = useState(false)
  const [draggingCover, setDraggingCover] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const coverPreviewRef = useRef<HTMLDivElement>(null)
  const [slug, setSlug] = useState<string | null>(null)
  const [slugInput, setSlugInput] = useState('')
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [slugSuccess, setSlugSuccess] = useState(false)
  const [copied, setCopied] = useState(false)
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://prolink-delta.vercel.app'

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: practitioner } = await supabase
        .from('practitioners')
        .select('years_experience, certificates, specialty_tags, cover_image_url, cover_image_position, brand_color, slug')
        .eq('user_id', user.id)
        .single()
      setData(practitioner as BrandData)
      const existingSlug = (practitioner as { slug?: string | null })?.slug ?? null
      setSlug(existingSlug)
      const certs = (practitioner?.certificates as CertificateEntry[]) ?? []
      setCertificates(certs.length > 0 ? certs : [{ name: '', year: null }])
      setBrandColor(practitioner?.brand_color ?? '#4A7C59')
      setYearsExperienceInput(practitioner?.years_experience != null ? String(practitioner.years_experience) : '')
      setSpecialtyTagsInput((practitioner?.specialty_tags ?? []).join(', '))
      setCoverUrl(practitioner?.cover_image_url ?? null)
      setCoverPosition((practitioner as { cover_image_position?: string })?.cover_image_position ?? '50% 50%')

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, display_name_updated_at')
        .eq('id', user.id)
        .single()
      setAvatarUrl(profile?.avatar_url ?? null)
      setDisplayName(profile?.display_name ?? null)
      setNameInput(profile?.display_name ?? '')
      setSlugInput(existingSlug ?? slugifySuggestion(profile?.display_name ?? ''))
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

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingCover(true)
    setCoverError(null)
    setCoverSuccess(false)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('尚未登入')

      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/cover.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('covers')
        .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from('covers').getPublicUrl(path)
      const publicUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`

      setCoverUrl(publicUrl)
      setCoverPosition('50% 50%')
    } catch (err) {
      console.error(err)
      setCoverError('上傳失敗，請再試一次')
    } finally {
      setUploadingCover(false)
    }
  }

  function handleCoverPointerEvent(e: React.PointerEvent<HTMLDivElement>) {
    const box = coverPreviewRef.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100))
    setCoverPosition(`${x.toFixed(0)}% ${y.toFixed(0)}%`)
  }

  async function handleCoverSave() {
    setCoverSaving(true)
    setCoverSuccess(false)
    try {
      const formData = new FormData()
      formData.set('coverImageUrl', coverUrl ?? '')
      formData.set('coverImagePosition', coverPosition)
      await updateCoverImage(formData)
      setCoverSuccess(true)
      setTimeout(() => setCoverSuccess(false), 2000)
    } finally {
      setCoverSaving(false)
    }
  }

  async function handleSlugSave() {
    setSlugSaving(true)
    setSlugError(null)
    setSlugSuccess(false)
    try {
      const formData = new FormData()
      formData.set('slug', slugInput)
      const result = await updateSlug(formData)
      if (result?.error) {
        setSlugError(result.error)
      } else if (result?.slug) {
        setSlug(result.slug)
        setSlugInput(result.slug)
        setSlugSuccess(true)
        setTimeout(() => setSlugSuccess(false), 2000)
      }
    } finally {
      setSlugSaving(false)
    }
  }

  async function handleBrandInfoSave() {
    setBrandInfoSaving(true)
    setBrandInfoSuccess(false)
    try {
      const formData = new FormData()
      formData.set('yearsExperience', yearsExperienceInput)
      formData.set('certificates', JSON.stringify(certificates.filter(c => c.name.trim())))
      formData.set('specialtyTags', specialtyTagsInput)
      formData.set('brandColor', brandColor)
      await updateBrandInfo(formData)
      setBrandInfoSuccess(true)
      setTimeout(() => setBrandInfoSuccess(false), 2000)
    } finally {
      setBrandInfoSaving(false)
    }
  }

  function handleCopyLink() {
    if (!slug) return
    navigator.clipboard.writeText(`${siteUrl}/p/${slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
            <Link2 className="w-4 h-4 text-primary" />
            我的專屬預約連結
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            設定一個好記的網址代號，放到 Instagram 個人簡介或其他社群帳號，客人點擊後可直接進到你的頁面預約。
          </p>
          <div>
            <Label>網址代號</Label>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-sm text-muted-foreground whitespace-nowrap">{siteUrl}/p/</span>
              <Input
                value={slugInput}
                onChange={(e) => { setSlugInput(e.target.value.toLowerCase()); setSlugError(null) }}
                placeholder="例：yangyi-massage"
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">只能用小寫英文、數字、連字號(-)，3~30個字</p>
            {slugError && <p className="text-xs text-destructive mt-1.5">{slugError}</p>}
            {slugSuccess && <p className="text-xs text-green-600 mt-1.5">已儲存</p>}
            <Button
              type="button"
              size="sm"
              className="mt-2 active:scale-95 transition-transform"
              disabled={slugSaving || !slugInput || slugInput === slug}
              onClick={handleSlugSave}
            >
              {slugSaving ? '儲存中...' : '儲存代號'}
            </Button>
          </div>

          {slug && (
            <div className="flex items-center justify-between bg-muted/40 rounded-xl px-3 py-2.5">
              <a href={`/p/${slug}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary truncate underline-offset-2 hover:underline">
                {siteUrl}/p/{slug}
              </a>
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-muted-foreground hover:text-primary active:scale-90 transition-transform shrink-0 ml-2"
                title="複製連結"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

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
        <div className="flex flex-col gap-3">
          <div>
            <Label>執業年資</Label>
            <Input
              type="number"
              value={yearsExperienceInput}
              onChange={e => setYearsExperienceInput(e.target.value)}
              placeholder="例：5"
              className="mt-1"
              min={0}
            />
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
          </div>
          <div>
            <Label>專長標籤（用逗號分隔）</Label>
            <Input
              value={specialtyTagsInput}
              onChange={e => setSpecialtyTagsInput(e.target.value)}
              placeholder="例：運動按摩, 深層組織按摩, 久坐族群調理"
              className="mt-1"
            />
          </div>
          <div>
            <Label>封面照</Label>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              上傳後可在下方預覽圖點擊或拖曳，選擇要顯示的部分
            </p>
            {coverUrl && (
              <div
                ref={coverPreviewRef}
                onPointerDown={(e) => { setDraggingCover(true); handleCoverPointerEvent(e) }}
                onPointerMove={(e) => { if (draggingCover) handleCoverPointerEvent(e) }}
                onPointerUp={() => setDraggingCover(false)}
                onPointerLeave={() => setDraggingCover(false)}
                className="relative w-full h-32 rounded-xl border border-border bg-cover bg-no-repeat cursor-crosshair touch-none mb-2 overflow-hidden"
                style={{ backgroundImage: `url(${coverUrl})`, backgroundPosition: coverPosition }}
              >
                <div
                  className="absolute w-4 h-4 rounded-full border-2 border-white bg-primary/80 shadow pointer-events-none -translate-x-1/2 -translate-y-1/2"
                  style={{ left: coverPosition.split(' ')[0], top: coverPosition.split(' ')[1] }}
                />
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingCover}
              onClick={() => coverInputRef.current?.click()}
              className="active:scale-95 transition-transform"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              {uploadingCover ? '上傳中...' : coverUrl ? '更換封面照' : '上傳封面照'}
            </Button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleCoverChange}
              className="hidden"
            />
            {coverError && <p className="text-xs text-destructive mt-1.5">{coverError}</p>}
            <div className="mt-2 flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={coverSaving}
                onClick={handleCoverSave}
                className="active:scale-95 transition-transform"
              >
                {coverSaving ? '儲存中...' : '儲存封面'}
              </Button>
              {coverSuccess && <span className="text-xs text-green-600">已儲存</span>}
            </div>
          </div>
          <div>
            <Label>品牌主色</Label>
            <p className="text-xs text-muted-foreground mt-1 mb-2">套用於您公開頁面的封面疊色與預約按鈕，不影響其他老師或全站樣式</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESET_COLORS.map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  title={preset.label}
                  onClick={() => setBrandColor(preset.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform active:scale-90 ${
                    brandColor.toLowerCase() === preset.value.toLowerCase() ? 'border-foreground' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: preset.value }}
                />
              ))}
              <input
                type="color"
                value={brandColor}
                onChange={e => setBrandColor(e.target.value)}
                className="w-8 h-8 rounded-full border-2 border-input cursor-pointer p-0 overflow-hidden"
                title="自訂顏色"
              />
            </div>
            <p className="text-xs text-muted-foreground">目前選擇：{brandColor}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              disabled={brandInfoSaving}
              onClick={handleBrandInfoSave}
              className="active:scale-95 transition-transform"
            >
              {brandInfoSaving ? '儲存中...' : '儲存'}
            </Button>
            {brandInfoSuccess && <span className="text-xs text-green-600">已儲存</span>}
          </div>
        </div>
      </CardContent>
      </Card>
    </div>
  )
}
