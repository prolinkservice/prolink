'use client'

import { useState, type ReactNode } from 'react'
import { User, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AdminReviewItem {
  key: string
  title: string
  subtitle: ReactNode
  content: ReactNode
}

export function AdminReviewLayout({ items }: { items: AdminReviewItem[] }) {
  const [activeKey, setActiveKey] = useState(items[0]?.key)
  const active = items.find((item) => item.key === activeKey) ?? items[0]

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <div className="w-full lg:w-72 shrink-0 rounded-xl border border-border bg-white overflow-hidden divide-y divide-border">
        {items.map((item) => {
          const isActive = item.key === active?.key
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
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{item.subtitle}</div>
              </div>
              {isActive && <ChevronRight className="w-4 h-4 text-primary shrink-0" />}
            </button>
          )
        })}
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-border p-6 min-w-0 w-full">
        {active?.content}
      </div>
    </div>
  )
}
