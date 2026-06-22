'use client'

import { useEffect, useRef, useState } from 'react'
import { CreditCard, IdCard, CheckCircle2, Clock, XCircle, FileImage, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { addWatermarkToImage } from '@/lib/watermark'
import { ImageLightbox } from '@/components/ImageLightbox'
import { updateVerification } from '../actions'

const STATUS_CONFIG: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  not_submitted: { label: '未上傳', className: 'text-muted-foreground bg-muted border-border', Icon: Clock },
  pending: { label: '審核中', className: 'text-amber-600 bg-amber-50 border-amber-200', Icon: Clock },
  approved: { label: '已通過', className: 'text-green-600 bg-green-50 border-green-200', Icon: CheckCircle2 },
  rejected: { label: '已退回', className: 'text-destructive bg-destructive/5 border-destructive/20', Icon: XCircle },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_submitted
  const Icon = cfg.Icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.className}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

interface VerificationData {
  bank_name: string | null
  bank_account: string | null
  bank_status: string
  passbook_url: string | null
  id_front_url: string | null
  id_back_url: string | null
  id_verification_status: string
}

type Side = 'front' | 'back'

export function VerificationForm() {
  const [data, setData] = useState<VerificationData | null>(null)
  const [loading, setLoading] = useState(true)

  const [uploadingPassbook, setUploadingPassbook] = useState(false)
  const [passbookPath, setPassbookPath] = useState<string | null>(null)
  const [passbookPreviewUrl, setPassbookPreviewUrl] = useState<string | null>(null)
  const [passbookError, setPassbookError] = useState<string | null>(null)
  const passbookInputRef = useRef<HTMLInputElement>(null)

  const [uploadingFront, setUploadingFront] = useState(false)
  const [uploadingBack, setUploadingBack] = useState(false)
  const [idFrontPath, setIdFrontPath] = useState<string | null>(null)
  const [idBackPath, setIdBackPath] = useState<string | null>(null)
  const [frontPreviewUrl, setFrontPreviewUrl] = useState<string | null>(null)
  const [backPreviewUrl, setBackPreviewUrl] = useState<string | null>(null)
  const [errorFront, setErrorFront] = useState<string | null>(null)
  const [errorBack, setErrorBack] = useState<string | null>(null)
  const frontInputRef = useRef<HTMLInputElement>(null)
  const backInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: practitioner } = await supabase
        .from('practitioners')
        .select('bank_name, bank_account, bank_status, passbook_url, id_front_url, id_back_url, id_verification_status')
        .eq('user_id', user.id)
        .single()
      const p = practitioner as VerificationData | null
      setData(p)

      const passbook = p?.passbook_url ?? null
      const frontPath = p?.id_front_url ?? null
      const backPath = p?.id_back_url ?? null
      setPassbookPath(passbook)
      setIdFrontPath(frontPath)
      setIdBackPath(backPath)

      if (passbook) {
        const { data: signed } = await supabase.storage.from('verification-docs').createSignedUrl(passbook, 600)
        if (signed) setPassbookPreviewUrl(signed.signedUrl)
      }
      if (frontPath) {
        const { data: signed } = await supabase.storage.from('verification-docs').createSignedUrl(frontPath, 600)
        if (signed) setFrontPreviewUrl(signed.signedUrl)
      }
      if (backPath) {
        const { data: signed } = await supabase.storage.from('verification-docs').createSignedUrl(backPath, 600)
        if (signed) setBackPreviewUrl(signed.signedUrl)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handlePassbookChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPassbook(true)
    setPassbookError(null)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('尚未登入')

      const watermarkedBlob = await addWatermarkToImage(file, '僅供 ProLink 審核用')
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/passbook.${ext}`

      const { error } = await supabase.storage
        .from('verification-docs')
        .upload(path, watermarkedBlob, { upsert: true, contentType: file.type || 'image/jpeg' })

      if (error) throw error

      setPassbookPath(path)
      setPassbookPreviewUrl(URL.createObjectURL(watermarkedBlob))
    } catch (err) {
      console.error(err)
      setPassbookError('上傳失敗，請再試一次')
    } finally {
      setUploadingPassbook(false)
    }
  }

  async function handleIdFileChange(e: React.ChangeEvent<HTMLInputElement>, side: Side) {
    const file = e.target.files?.[0]
    if (!file) return

    const setUploading = side === 'front' ? setUploadingFront : setUploadingBack
    const setPath = side === 'front' ? setIdFrontPath : setIdBackPath
    const setError = side === 'front' ? setErrorFront : setErrorBack
    const setPreview = side === 'front' ? setFrontPreviewUrl : setBackPreviewUrl
    const fileName = side === 'front' ? 'id_front' : 'id_back'

    setUploading(true)
    setError(null)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('尚未登入')

      const watermarkedBlob = await addWatermarkToImage(file, '僅供 ProLink 審核用')
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/${fileName}.${ext}`

      const { error } = await supabase.storage
        .from('verification-docs')
        .upload(path, watermarkedBlob, { upsert: true, contentType: file.type || 'image/jpeg' })

      if (error) throw error

      setPath(path)
      setPreview(URL.createObjectURL(watermarkedBlob))
    } catch (err) {
      console.error(err)
      setError('上傳失敗，請再試一次')
    } finally {
      setUploading(false)
    }
  }

  if (loading || !data) {
    return <p className="text-muted-foreground text-sm text-center py-8">載入中...</p>
  }

  const uploading = uploadingPassbook || uploadingFront || uploadingBack

  return (
    <form action={updateVerification} className="flex flex-col gap-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            銀行帳戶
          </CardTitle>
          <StatusBadge status={data.bank_status} />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <Label>銀行名稱</Label>
              <Input name="bankName" defaultValue={data.bank_name ?? ''} placeholder="例：台灣銀行" className="mt-1" />
            </div>
            <div>
              <Label>銀行帳號</Label>
              <Input name="bankAccount" defaultValue={data.bank_account ?? ''} placeholder="請輸入帳號" className="mt-1" />
            </div>
          </div>

          <div>
            <Label>存摺影本</Label>
            <div className="mt-1 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingPassbook}
                onClick={() => passbookInputRef.current?.click()}
                className="active:scale-95 transition-transform"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                {uploadingPassbook ? '上傳中...' : '選擇圖片'}
              </Button>
              <input
                ref={passbookInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handlePassbookChange}
                className="hidden"
              />
              {passbookPath && !uploadingPassbook && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                  <FileImage className="w-3.5 h-3.5" />
                  已上傳存摺影本
                </span>
              )}
            </div>
            {passbookPreviewUrl && (
              <div className="mt-2 max-w-md rounded-lg border border-border overflow-hidden">
                <ImageLightbox src={passbookPreviewUrl} alt="存摺影本預覽" className="max-w-full max-h-[400px] object-contain cursor-zoom-in" />
              </div>
            )}
            {passbookError && <p className="text-xs text-destructive mt-1">{passbookError}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <IdCard className="w-4 h-4 text-primary" />
            身份驗證
          </CardTitle>
          <StatusBadge status={data.id_verification_status} />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <Label>身分證正面照片</Label>
              <div className="mt-1 flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingFront}
                  onClick={() => frontInputRef.current?.click()}
                  className="active:scale-95 transition-transform"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  {uploadingFront ? '上傳中...' : '選擇圖片'}
                </Button>
                <input
                  ref={frontInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(e) => handleIdFileChange(e, 'front')}
                  className="hidden"
                />
                {idFrontPath && !uploadingFront && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600">
                    <FileImage className="w-3.5 h-3.5" />
                    已上傳
                  </span>
                )}
              </div>
              {frontPreviewUrl && (
                <div className="mt-2 max-w-md rounded-lg border border-border overflow-hidden">
                  <ImageLightbox src={frontPreviewUrl} alt="身分證正面預覽" className="max-w-full max-h-[400px] object-contain cursor-zoom-in" />
                </div>
              )}
              {errorFront && <p className="text-xs text-destructive mt-1">{errorFront}</p>}
            </div>
            <div>
              <Label>身分證反面照片</Label>
              <div className="mt-1 flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingBack}
                  onClick={() => backInputRef.current?.click()}
                  className="active:scale-95 transition-transform"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  {uploadingBack ? '上傳中...' : '選擇圖片'}
                </Button>
                <input
                  ref={backInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={(e) => handleIdFileChange(e, 'back')}
                  className="hidden"
                />
                {idBackPath && !uploadingBack && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600">
                    <FileImage className="w-3.5 h-3.5" />
                    已上傳
                  </span>
                )}
              </div>
              {backPreviewUrl && (
                <div className="mt-2 max-w-md rounded-lg border border-border overflow-hidden">
                  <ImageLightbox src={backPreviewUrl} alt="身分證反面預覽" className="max-w-full max-h-[400px] object-contain cursor-zoom-in" />
                </div>
              )}
              {errorBack && <p className="text-xs text-destructive mt-1">{errorBack}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground -mt-1">上傳後會自動加上審核浮水印，僅供 ProLink 審核使用</p>

      <input type="hidden" name="passbookUrl" value={passbookPath ?? ''} />
      <input type="hidden" name="idFrontUrl" value={idFrontPath ?? ''} />
      <input type="hidden" name="idBackUrl" value={idBackPath ?? ''} />

      <Button type="submit" size="sm" disabled={uploading} className="self-start active:scale-95 transition-transform">
        {uploading ? '上傳中...' : '儲存並送審'}
      </Button>
      <p className="text-xs text-muted-foreground">修改後將重新進入審核狀態</p>
    </form>
  )
}
