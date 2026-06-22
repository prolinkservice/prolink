'use client'

import { useEffect, useRef, useState } from 'react'
import { CreditCard, CheckCircle2, Clock, XCircle, FileImage, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { addWatermarkToImage } from '@/lib/watermark'
import { updateBankAccount } from '../actions'

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

interface BankData {
  bank_name: string | null
  bank_account: string | null
  bank_status: string
  passbook_url: string | null
}

export function BankForm() {
  const [data, setData] = useState<BankData | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [passbookPath, setPassbookPath] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: practitioner } = await supabase
        .from('practitioners')
        .select('bank_name, bank_account, bank_status, passbook_url')
        .eq('user_id', user.id)
        .single()
      setData(practitioner as BankData)
      const path = (practitioner as BankData | null)?.passbook_url ?? null
      setPassbookPath(path)
      if (path) {
        const { data: signed } = await supabase.storage.from('verification-docs').createSignedUrl(path, 600)
        if (signed) setPreviewUrl(signed.signedUrl)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError(null)
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
      setPreviewUrl(URL.createObjectURL(watermarkedBlob))
    } catch (err) {
      console.error(err)
      setUploadError('上傳失敗，請再試一次')
    } finally {
      setUploading(false)
    }
  }

  if (loading || !data) {
    return <p className="text-muted-foreground text-sm text-center py-8">載入中...</p>
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          銀行帳戶
        </CardTitle>
        <StatusBadge status={data.bank_status} />
      </CardHeader>
      <CardContent>
        <form action={updateBankAccount} className="flex flex-col gap-3">
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
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="active:scale-95 transition-transform"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                {uploading ? '上傳中...' : '選擇圖片'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleFileChange}
                className="hidden"
              />
              {passbookPath && !uploading && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600">
                  <FileImage className="w-3.5 h-3.5" />
                  已上傳存摺影本
                </span>
              )}
            </div>
            {previewUrl && (
              <div className="mt-2 max-w-md rounded-lg border border-border overflow-hidden">
                <img src={previewUrl} alt="存摺影本預覽" className="max-w-full max-h-[400px] object-contain cursor-zoom-in" />
              </div>
            )}
            {uploadError && <p className="text-xs text-destructive mt-1">{uploadError}</p>}
            <p className="text-xs text-muted-foreground mt-1">上傳後會自動加上審核浮水印，僅供 ProLink 審核使用</p>
          </div>

          <input type="hidden" name="passbookUrl" value={passbookPath ?? ''} />

          <Button type="submit" size="sm" disabled={uploading} className="self-start active:scale-95 transition-transform">
            {uploading ? '上傳中...' : '儲存並送審'}
          </Button>
          <p className="text-xs text-muted-foreground">修改後將重新進入審核狀態</p>
        </form>
      </CardContent>
    </Card>
  )
}
