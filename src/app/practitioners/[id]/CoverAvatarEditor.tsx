'use client'

import { useRef, useState } from 'react'
import { Camera, Check } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { updateAvatar, updateCoverImage } from '@/app/practitioner/dashboard/profile/actions'

export function CoverAvatarEditor({
  name,
  avatarUrl: initialAvatarUrl,
  coverImageUrl: initialCoverUrl,
  coverImagePosition: initialCoverPosition,
  brandColor,
  isOwner,
}: {
  name: string
  avatarUrl: string
  coverImageUrl: string | null
  coverImagePosition: string
  brandColor: string
  isOwner: boolean
}) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl)
  const [coverPosition, setCoverPosition] = useState(initialCoverPosition || '50% 50%')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [editingCover, setEditingCover] = useState(false)
  const [draggingCover, setDraggingCover] = useState(false)
  const [savingCover, setSavingCover] = useState(false)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const coverBoxRef = useRef<HTMLDivElement>(null)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
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
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCover(true)
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
      setEditingCover(true)
    } catch (err) {
      console.error(err)
    } finally {
      setUploadingCover(false)
    }
  }

  function handleCoverPointerEvent(e: React.PointerEvent<HTMLDivElement>) {
    const box = coverBoxRef.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100))
    setCoverPosition(`${x.toFixed(0)}% ${y.toFixed(0)}%`)
  }

  async function handleSaveCoverPosition() {
    setSavingCover(true)
    try {
      const formData = new FormData()
      formData.set('coverImageUrl', coverUrl ?? '')
      formData.set('coverImagePosition', coverPosition)
      await updateCoverImage(formData)
      setEditingCover(false)
    } finally {
      setSavingCover(false)
    }
  }

  return (
    <div
      ref={coverBoxRef}
      onPointerDown={(e) => { if (editingCover) { setDraggingCover(true); handleCoverPointerEvent(e) } }}
      onPointerMove={(e) => { if (editingCover && draggingCover) handleCoverPointerEvent(e) }}
      onPointerUp={() => setDraggingCover(false)}
      onPointerLeave={() => setDraggingCover(false)}
      className={`relative h-40 bg-cover bg-no-repeat ${editingCover ? 'cursor-crosshair touch-none' : ''}`}
      style={
        coverUrl
          ? {
              backgroundImage: `linear-gradient(to bottom right, ${brandColor}99, ${brandColor}4D), url(${coverUrl})`,
              backgroundPosition: coverPosition,
            }
          : { backgroundImage: `linear-gradient(to bottom right, ${brandColor}, #E0935D)` }
      }
    >
      <Avatar className="absolute left-4 -bottom-8 w-20 h-20 border-[3px] border-white shadow-sm">
        <AvatarImage src={avatarUrl} />
        <AvatarFallback className="bg-accent text-foreground text-2xl font-bold">{name[0]}</AvatarFallback>
      </Avatar>

      {isOwner && (
        <>
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute left-[4.5rem] bottom-[-1.75rem] w-7 h-7 rounded-full bg-foreground text-white flex items-center justify-center shadow active:scale-90 transition-transform"
            title="更換大頭照"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
          <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleAvatarChange} className="hidden" />

          <input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleCoverChange} className="hidden" />
          {editingCover ? (
            <button
              type="button"
              onClick={handleSaveCoverPosition}
              disabled={savingCover}
              className="absolute right-3 top-3 flex items-center gap-1 px-3 py-1.5 rounded-full bg-foreground text-white text-xs font-medium shadow active:scale-95 transition-transform"
            >
              <Check className="w-3.5 h-3.5" />
              {savingCover ? '儲存中...' : '完成'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => (coverUrl ? setEditingCover(true) : coverInputRef.current?.click())}
              disabled={uploadingCover}
              className="absolute right-3 top-3 flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/90 text-foreground text-xs font-medium shadow active:scale-95 transition-transform"
            >
              <Camera className="w-3.5 h-3.5" />
              {uploadingCover ? '上傳中...' : coverUrl ? '調整封面' : '上傳封面'}
            </button>
          )}
          {editingCover && (
            <div className="absolute left-3 top-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-[11px]">
              點擊或拖曳調整位置
            </div>
          )}
        </>
      )}
    </div>
  )
}
