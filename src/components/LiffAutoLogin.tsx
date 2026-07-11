'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID

// 只在 LINE App 內建瀏覽器開啟時才會動作：靜默用 LIFF 換 ProLink 登入 session，
// 一般手機/電腦瀏覽器完全不受影響，還是走 /auth 頁面既有的「使用 LINE 登入」按鈕。
export function LiffAutoLogin() {
  const router = useRouter()
  const pathname = usePathname()
  const ranRef = useRef(false)

  useEffect(() => {
    if (!LIFF_ID || ranRef.current) return
    ranRef.current = true

    let cancelled = false

    ;(async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session) return

      const { default: liff } = await import('@line/liff')
      try {
        await liff.init({ liffId: LIFF_ID })
      } catch (err) {
        console.error('[liff] init failed', err)
        return
      }
      if (cancelled || !liff.isInClient()) return

      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href })
        return
      }

      const idToken = liff.getIDToken()
      if (!idToken) return

      const res = await fetch('/api/auth/liff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
      if (cancelled || !res.ok) {
        if (!res.ok) console.error('[liff] auto login failed', await res.text())
        return
      }

      const data = await res.json()
      if (data.isNewAccount) {
        router.push(`/auth/line/added?next=${encodeURIComponent(pathname || '/')}`)
      } else {
        router.refresh()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router, pathname])

  return null
}
