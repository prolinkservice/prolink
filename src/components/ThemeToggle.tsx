'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// 亮度自己選。深色代幣本來就在 globals.css 裡，只是綁死「跟隨系統」——
// 系統是淺色的人就永遠看白底，長時間盯著會累。
//
// 選擇存在 cookie，由 root layout 在伺服器端讀出來寫進 <html data-theme>，
// 所以重新整理不會先閃一下白的。

export type Theme = 'auto' | 'light' | 'dark'

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'auto', label: '自動' },
  { value: 'light', label: '淺' },
  { value: 'dark', label: '深' },
]

export const THEME_COOKIE = 'prolink-theme'

export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial)

  // <html data-theme> 與 cookie 都是 React 樹外面的東西，
  // 所以在 effect 裡同步，而不是在點擊當下直接改
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    // 一年份，SameSite=Lax 就夠：這不是機密，只是偏好
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`
  }, [theme])

  return (
    <div
      role="radiogroup"
      aria-label="畫面亮度"
      className="flex shrink-0 gap-0.5 rounded-full bg-sunk p-1"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={theme === o.value}
          onClick={() => setTheme(o.value)}
          className={cn(
            'rounded-full px-3 py-1.5 text-[11.5px] font-extrabold transition',
            theme === o.value
              ? 'bg-card text-ink shadow-soft'
              : 'text-ink-3 hover:text-ink'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
