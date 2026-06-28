'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Calendar, ListChecks, ClipboardList, Users, BarChart3, UserCog, Star, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavEntry {
  href: string
  icon: typeof LayoutDashboard
  label: string
  children?: { href: string; icon: typeof LayoutDashboard; label: string }[]
}

const ENTRIES: NavEntry[] = [
  { href: '/practitioner/dashboard', icon: LayoutDashboard, label: '總覽' },
  { href: '/practitioner/dashboard/profile/brand', icon: Sparkles, label: '品牌頁面' },
  {
    href: '/practitioner/dashboard/services',
    icon: ListChecks,
    label: '服務管理',
    children: [
      { href: '/practitioner/dashboard/availability', icon: Calendar, label: '時段管理' },
      { href: '/practitioner/dashboard/bookings', icon: ClipboardList, label: '預約管理' },
    ],
  },
  { href: '/practitioner/dashboard/students', icon: Users, label: '學員列表' },
  { href: '/practitioner/dashboard/analytics', icon: BarChart3, label: '數據分析' },
  { href: '/practitioner/dashboard/profile', icon: UserCog, label: '會員中心' },
  { href: '/practitioner/dashboard/reviews', icon: Star, label: '我的評價' },
]

export function DashboardSideNav() {
  const pathname = usePathname()

  function isLinkActive(href: string) {
    if (href === '/practitioner/dashboard') return pathname === href
    if (href === '/practitioner/dashboard/profile') {
      return pathname.startsWith(href) && !pathname.startsWith('/practitioner/dashboard/profile/brand')
    }
    return pathname.startsWith(href)
  }

  return (
    <nav className="w-56 h-full shrink-0 border-r border-border bg-white py-3 px-2 flex flex-col gap-0.5 overflow-y-auto">
      {ENTRIES.map((entry) => {
        const Icon = entry.icon
        const isActive = isLinkActive(entry.href)
        return (
          <div key={entry.href}>
            <Link
              href={entry.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive ? 'bg-accent/60 text-primary font-medium' : 'text-foreground hover:bg-muted/50'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {entry.label}
            </Link>
            {entry.children && (
              <div className="ml-4 pl-3 border-l border-border flex flex-col gap-0.5 mt-0.5 mb-1">
                {entry.children.map((child) => {
                  const ChildIcon = child.icon
                  const childActive = isLinkActive(child.href)
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                        childActive ? 'bg-accent/60 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/50'
                      )}
                    >
                      <ChildIcon className="w-3.5 h-3.5 shrink-0" />
                      {child.label}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
