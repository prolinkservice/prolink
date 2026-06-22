'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { updateBrandInfo, updateAvatar } from '../actions'

interface BrandData {
  years_experience: number | null
  certificate_name: string | null
  specialty_tags: string[] | null
  cover_image_url: string | null
}

export function BrandForm() {
  const [data, setData] = useState<BrandData | null>(null)
  const [loading, setLoading] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: practitioner } = await supabase
        .from('practitioners')
        .select('years_experience, certificate_name, specialty_tags, cover_image_url')
        .eq('user_id', user.id)
        .single()
      setData(practitioner as BrandData)

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', user.id)
        .single()
      setAvatarUrl(profile?.avatar_url ?? null)
      setDisplayName(profile?.display_name ?? null)
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
          個人品牌
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={updateBrandInfo} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <Label>執業年資</Label>
              <Input type="number" name="yearsExperience" defaultValue={data.years_experience ?? ''} placeholder="例：5" className="mt-1" min={0} />
            </div>
            <div>
              <Label>證照名稱</Label>
              <Input name="certificateName" defaultValue={data.certificate_name ?? ''} placeholder="例：中醫推拿執照" className="mt-1" />
            </div>
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
