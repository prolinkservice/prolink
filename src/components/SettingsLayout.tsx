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
}

export function SettingsLayout({ items }: SettingsLayoutProps) {
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

      {/* 桌面版：左右分欄 */}
      <div className="hidden lg:flex gap-6 items-start">
        <div className="w-72 shrink-0 rounded-xl border border-border bg-white divide-y divide-border overflow-hidden">
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

        <div className="flex-1 bg-white rounded-2xl border border-border p-6 min-w-0">
          {activeItem?.content}
        </div>
      </div>
    </>
  )
}
