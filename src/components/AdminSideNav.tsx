'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ClipboardCheck, Users, BarChart3, UserCog } from 'lucide-react'
import { cn } from '@/lib/utils'

const ENTRIES = [
  { href: '/admin', icon: LayoutDashboard, label: '總覽' },
  { href: '/admin/review', icon: ClipboardCheck, label: '待審核' },
  { href: '/admin/practitioners', icon: Users, label: '已上架職人' },
  { href: '/admin/users', icon: UserCog, label: '會員管理' },
  { href: '/admin/analytics', icon: BarChart3, label: '使用分析報表' },
]

export function AdminSideNav() {
  const pathname = usePathname()

  return (
    <nav className="w-full lg:w-56 lg:h-full rounded-xl lg:rounded-none border border-border lg:border-0 lg:border-r bg-white overflow-hidden lg:overflow-y-auto divide-y divide-border lg:divide-y-0 lg:py-3 lg:px-2 lg:flex lg:flex-col lg:gap-0.5">
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
              'flex items-center gap-3 px-4 py-3 lg:px-3 lg:py-2.5 lg:rounded-lg text-sm transition-colors',
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
