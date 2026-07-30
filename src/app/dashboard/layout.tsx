import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentTenant } from '@/lib/tenant'
import { CopyLinkButton } from './CopyLinkButton'

// 後台外框。側欄分成「每天要用」與「設定」兩區——
// 天天要點的永遠在最上面，設定類的擺下面，不要混在一起讓人每天翻找。
// 草稿：docs/mockups/landing-and-onboarding.html §03

const DAILY = [
  { href: '/dashboard', label: '今日行程', ready: true },
  { href: '/dashboard/calendar', label: '行事曆', ready: true },
  { href: '/dashboard/customers', label: '客戶管理', ready: false },
]

const SETTINGS = [
  { href: '/dashboard/services', label: '服務項目', ready: true },
  { href: '/dashboard/schedule', label: '營業時間與據點', ready: true },
  { href: '/dashboard/line', label: 'LINE 官方帳號', ready: true },
  { href: '/dashboard/payments', label: '定金與收款', ready: false },
]

const ACCOUNT = [
  { href: '/dashboard/billing', label: '方案與帳單', ready: false },
  { href: '/dashboard/account', label: '帳號設定', ready: false },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // 同 /onboarding：/login 只有帳密，OAuth 註冊的人會卡住
  if (!user) redirect('/auth?next=/dashboard')

  const current = await getCurrentTenant()
  if (!current) redirect('/onboarding')

  const { tenant, member } = current
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://prolink.tw').replace(/\/$/, '')
  const bookingUrl = `${siteUrl}/p/${tenant.slug}`

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-0.5 bg-card p-3 lg:w-56">
        <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-4">
          <span className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-primary text-xs font-extrabold text-primary-foreground">
            {tenant.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <b className="block truncate text-[13.5px] leading-tight font-extrabold tracking-tight">
              {tenant.name}
            </b>
            <small className="text-[10px] font-bold text-ink-4">{member.display_name}</small>
          </div>
        </div>

        <NavGroup title="每天要用" items={DAILY} />
        <NavGroup title="設定" items={SETTINGS} />
        <div className="mt-auto hidden pt-3 lg:block">
          <NavGroup items={ACCOUNT} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5 px-6 pt-5 pb-1">
          <span className="ml-auto flex items-center gap-2 rounded-full bg-card py-2 pr-2 pl-4 text-xs font-bold text-ink-3 shadow-soft">
            <span className="hidden sm:inline">/p/</span>
            <b className="font-extrabold text-primary">{tenant.slug}</b>
            <CopyLinkButton url={bookingUrl} />
          </span>
          <Link
            href={`/p/${tenant.slug}`}
            className="rounded-full bg-sunk px-4 py-2.5 text-xs font-extrabold text-ink-2 transition hover:bg-accent hover:text-accent-foreground"
          >
            預覽
          </Link>
        </div>
        {children}
      </div>
    </div>
  )
}

function NavGroup({
  title,
  items,
}: {
  title?: string
  items: { href: string; label: string; ready: boolean }[]
}) {
  return (
    <>
      {title && (
        <p className="px-3 pt-3.5 pb-1.5 text-[10px] font-extrabold tracking-[0.09em] text-ink-4">
          {title}
        </p>
      )}
      {items.map((item) =>
        item.ready ? (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2.5 rounded-sm px-3 py-2.5 text-[13px] font-semibold text-ink-2 transition hover:bg-sunk hover:text-ink"
          >
            <span className="size-3.5 rounded-[5px] bg-current opacity-30" />
            {item.label}
          </Link>
        ) : (
          <span
            key={item.href}
            className="flex cursor-default items-center gap-2.5 rounded-sm px-3 py-2.5 text-[13px] font-semibold text-ink-4"
            title="還在做"
          >
            <span className="size-3.5 rounded-[5px] bg-current opacity-20" />
            {item.label}
            <span className="ml-auto text-[9px] font-extrabold tracking-wider">準備中</span>
          </span>
        )
      )}
    </>
  )
}
