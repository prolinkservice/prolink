'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Calendar, ListChecks, ClipboardList, Users, BarChart3, UserCog, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

const ENTRIES = [
  { href: '/practitioner/dashboard', icon: LayoutDashboard, label: '總覽' },
  { href: '/practitioner/dashboard/availability', icon: Calendar, label: '時段管理' },
  { href: '/practitioner/dashboard/services', icon: ListChecks, label: '服務管理' },
  { href: '/practitioner/dashboard/bookings', icon: ClipboardList, label: '預約管理' },
  { href: '/practitioner/dashboard/students', icon: Users, label: '學員列表' },
  { href: '/practitioner/dashboard/analytics', icon: BarChart3, label: '數據分析' },
  { href: '/practitioner/dashboard/profile', icon: UserCog, label: '會員中心' },
  { href: '/practitioner/dashboard/reviews', icon: Star, label: '我的評價' },
]

export function DashboardSideNav() {
  const pathname = usePathname()

  return (
    <nav className="w-60 shrink-0 sticky top-20 rounded-xl border border-border bg-white overflow-hidden divide-y divide-border">
      {ENTRIES.map((entry) => {
        const isActive = entry.href === '/practitioner/dashboard'
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
