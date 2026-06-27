'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ClipboardCheck, Users, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

const ENTRIES = [
  { href: '/admin', icon: LayoutDashboard, label: '總覽' },
  { href: '/admin/review', icon: ClipboardCheck, label: '待審核' },
  { href: '/admin/practitioners', icon: Users, label: '已上架職人' },
  { href: '/admin/analytics', icon: BarChart3, label: '使用分析報表' },
]

export function AdminSideNav() {
  const pathname = usePathname()

  return (
    <nav className="w-60 shrink-0 sticky top-20 rounded-xl border border-border bg-white overflow-hidden divide-y divide-border">
      {ENTRIES.map((entry) => {
        const isActive = entry.href === '/admin'
          ? pathname === entry.href
          : pathname.startsWith(entry.href)
        const Icon = entry.icon
        return (
          <Link
            key={entry.href}
            href={entry.href}
            className={cn(
              'flex items-center gap-3 px-4 py-3 text-sm transition-colors',
              isActive ? 'bg-accent/60 text-primary font-medium' : 'text-foreground hover:bg-muted/50'
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {entry.label}
          </Link>
        )
      })}
    </nav>
  )
}
