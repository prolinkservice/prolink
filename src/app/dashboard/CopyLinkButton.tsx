'use client'

import { useState } from 'react'

// 複製預約連結是職人最常做的動作之一，所以常駐在後台頂端
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        } catch {
          // 某些瀏覽器在非 https 下不給用剪貼簿，靜默失敗即可
        }
      }}
      className="rounded-full bg-accent px-3 py-1.5 text-[11px] font-extrabold text-accent-foreground transition hover:brightness-95"
    >
      {copied ? '已複製' : '複製'}
    </button>
  )
}
