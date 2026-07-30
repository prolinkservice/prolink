'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ThemeToggle, type Theme } from '@/components/ThemeToggle'
import { Stamp } from '@/components/Stamp'
import { CopyLinkButton } from './CopyLinkButton'

// 後台外框。草稿：docs/mockups/dashboard-shell-v2.html
//
// 三件事跟舊版不同：
//   · 內容有寬度上限並靠左，寬螢幕上不會被拉成一行掃很遠
//   · 側欄看得出目前在哪一頁（底色 + 左側色條 + 加粗）
//   · 頂部是有底色與分隔線的工具列，不是浮在右上角的兩顆藥丸

type NavItem = { href: string; label: string; ready: boolean }

const DAILY: NavItem[] = [
  { href: '/dashboard', label: '今日行程', ready: true },
  { href: '/dashboard/calendar', label: '行事曆', ready: true },
  { href: '/dashboard/customers', label: '客戶管理', ready: false },
]

const SETTINGS: NavItem[] = [
  { href: '/dashboard/services', label: '服務項目', ready: true },
  { href: '/dashboard/schedule', label: '營業時間與據點', ready: true },
  { href: '/dashboard/line', label: 'LINE 官方帳號', ready: true },
  { href: '/dashboard/payments', label: '定金與收款', ready: false },
]

const ACCOUNT: NavItem[] = [
  { href: '/dashboard/billing', label: '方案與帳單', ready: false },
  { href: '/dashboard/account', label: '帳號設定', ready: false },
]

const ALL = [...DAILY, ...SETTINGS, ...ACCOUNT]

export function DashboardShell({
  tenantName,
  roleLabel,
  slug,
  bookingUrl,
  theme,
  children,
}: {
  tenantName: string
  roleLabel: string
  slug: string
  bookingUrl: string
  theme: Theme
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const current = ALL.filter((i) => isActive(pathname, i.href)).sort(
    (a, b) => b.href.length - a.href.length
  )[0]

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-0.5 bg-card p-3 lg:w-56 lg:border-r lg:border-hairline">
        <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-4">
          <Stamp name={tenantName} className="size-9 text-[14px]" />
          <div className="min-w-0">
            <b className="block truncate text-[14px] leading-tight font-extrabold tracking-tight">
              {tenantName}
            </b>
            <small className="text-[11px] font-semibold text-ink-3">{roleLabel}</small>
          </div>
        </div>

        <NavGroup title="每天要用" items={DAILY} pathname={pathname} />
        <NavGroup title="設定" items={SETTINGS} pathname={pathname} />
        <div className="mt-auto hidden pt-3 lg:block">
          <NavGroup items={ACCOUNT} pathname={pathname} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2.5 bg-card px-5 py-2.5 lg:border-b lg:border-hairline">
          <span className="hidden text-[14px] font-extrabold tracking-tight lg:inline">
            {current?.label ?? '後台'}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 rounded-full bg-sunk py-1.5 pr-1.5 pl-3.5 text-[11.5px] font-bold text-ink-2">
              <span className="hidden sm:inline">/p/</span>
              <b className="font-extrabold text-primary">{slug}</b>
              <CopyLinkButton url={bookingUrl} />
            </span>
            <Link
              href={`/p/${slug}`}
              className="rounded-full bg-sunk px-4 py-2 text-[11.5px] font-extrabold text-ink-2 transition hover:bg-accent hover:text-accent-foreground"
            >
              預覽
            </Link>
            <ThemeToggle initial={theme} />
          </div>
        </header>

        <div className="w-full max-w-[1080px] px-5 py-6 sm:px-7">{children}</div>
      </div>
    </div>
  )
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavGroup({
  title,
  items,
  pathname,
}: {
  title?: string
  items: NavItem[]
  pathname: string
}) {
  return (
    <>
      {title && (
        <p className="px-3 pt-3.5 pb-1.5 text-[10.5px] font-extrabold tracking-[0.08em] text-ink-3">
          {title}
        </p>
      )}
      {items.map((item) =>
        item.ready ? (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            className={cn(
              'relative flex items-center gap-2.5 rounded-sm px-3 py-2.5 text-[13.5px] font-semibold transition',
              isActive(pathname, item.href)
                ? 'bg-accent font-extrabold text-accent-foreground'
                : 'text-ink-2 hover:bg-sunk hover:text-ink'
            )}
          >
            {isActive(pathname, item.href) && (
              <span className="absolute top-2.5 bottom-2.5 -left-3 w-[3px] rounded-r-[3px] bg-primary" />
            )}
            <span
              className={cn(
                'size-3.5 rounded-[5px] bg-current',
                isActive(pathname, item.href) ? 'opacity-100' : 'opacity-30'
              )}
            />
            {item.label}
          </Link>
        ) : (
          <span
            key={item.href}
            className="flex cursor-default items-center gap-2.5 rounded-sm px-3 py-2.5 text-[13.5px] font-semibold text-ink-4"
            title="還在做"
          >
            <span className="size-3.5 rounded-[5px] bg-current opacity-20" />
            {item.label}
            <span className="ml-auto text-[9.5px] font-extrabold tracking-wider">準備中</span>
          </span>
        )
      )}
    </>
  )
}
