'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SettingsLayoutItem {
  key: string
  icon: ReactNode
  label: string
  sublabel?: ReactNode
  href: string
  content: ReactNode
}

interface SettingsLayoutProps {
  items: SettingsLayoutItem[]
  header?: ReactNode
  /** 桌面版選單排列方向，預設 vertical（左側欄）。horizontal 會改成上方一排橫向分頁。 */
  direction?: 'vertical' | 'horizontal'
}

export function SettingsLayout({ items, header, direction = 'vertical' }: SettingsLayoutProps) {
  const [activeKey, setActiveKey] = useState(items[0]?.key)
  const activeItem = items.find((item) => item.key === activeKey) ?? items[0]

  return (
    <>
      {/* 手機版：列表 + 跳轉 */}
      <div className="lg:hidden rounded-xl border border-border bg-white divide-y divide-border overflow-hidden">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="flex items-center gap-3 px-4 py-3.5 bg-white hover:bg-muted/50 active:scale-[0.99] transition-all"
          >
            <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0">
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              {item.sublabel && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.sublabel}</p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>

      {direction === 'horizontal' ? (
        /* 桌面版：上方橫向分頁 + 下方內容 */
        <div className="hidden lg:flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-white overflow-hidden">
            {header && (
              <div className="px-4 py-4 border-b border-border">
                {header}
              </div>
            )}
            <div className="flex flex-wrap gap-2 p-3">
              {items.map((item) => {
                const isActive = item.key === activeItem?.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveKey(item.key)}
                    className={cn(
                      'flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-left transition-all border',
                      isActive ? 'bg-accent/60 border-primary/30' : 'bg-white border-transparent hover:bg-muted/50'
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground whitespace-nowrap">{item.label}</p>
                      {item.sublabel && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.sublabel}</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border p-6 min-w-0">
            {activeItem?.content}
          </div>
        </div>
      ) : (
        /* 桌面版：左右分欄 */
        <div className="hidden lg:flex gap-6 items-start">
          <div className="w-72 shrink-0 rounded-xl border border-border bg-white overflow-hidden">
            {header && (
              <div className="px-4 py-4 border-b border-border">
                {header}
              </div>
            )}
            <div className="divide-y divide-border">
            {items.map((item) => {
              const isActive = item.key === activeItem?.key
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveKey(item.key)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all',
                    isActive ? 'bg-accent/60' : 'bg-white hover:bg-muted/50'
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    {item.sublabel && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.sublabel}</p>
                    )}
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 text-primary shrink-0" />}
                </button>
              )
            })}
            </div>
          </div>

          <div className="flex-1 bg-white rounded-2xl border border-border p-6 min-w-0">
            {activeItem?.content}
          </div>
        </div>
      )}
    </>
  )
}
