'use client'

import { useState } from 'react'
import { Share2, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function ShareSection({ practitionerName, practitionerUrl }: { practitionerName: string; practitionerUrl: string }) {
  const [copied, setCopied] = useState(false)

  const shareText = `我剛在 ProLink 預約了 ${practitionerName} 的服務，分享給你看看！`

  async function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'ProLink',
          text: shareText,
          url: practitionerUrl,
        })
        return
      } catch {
        // 使用者取消分享或瀏覽器拒絕，不視為錯誤
        return
      }
    }
    handleCopy()
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${shareText} ${practitionerUrl}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 部分瀏覽器禁止剪貼簿存取，靜默失敗即可
    }
  }

  return (
    <Card className="w-full max-w-sm mb-6 bg-accent/30 border-accent">
      <CardContent className="p-4 flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">喜歡這次的預約體驗嗎？</p>
          <p className="text-xs text-muted-foreground mt-1">
            分享給朋友，或留下五星評價支持老師，讓更多人認識 {practitionerName}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" className="flex-1 active:scale-95 transition-transform" onClick={handleShare}>
            <Share2 className="w-3.5 h-3.5 mr-1.5" />
            分享給朋友
          </Button>
          <Button type="button" size="sm" variant="outline" className="flex-1 active:scale-95 transition-transform" onClick={handleCopy}>
            {copied ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
            {copied ? '已複製連結' : '複製連結'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
