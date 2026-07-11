import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, ClipboardList, LogOut, UserCog, Star, Home, ListChecks, Bell, Users, BarChart3, Sparkles } from 'lucide-react'
import { signOut } from '@/app/auth/actions'
import { SettingsListGroup, SettingsListItem } from '@/components/SettingsListItem'
import { FREE_CUSTOMER_LIMIT, getPractitionerCustomerCount, hasActiveSubscription } from '@/lib/subscription'

export default async function PractitionerDashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [{ data: profile }, { data: practitioner }] = await Promise.all([
    supabase.from('profiles').select('display_name, role').eq('id', user.id).single(),
    supabase.from('practitioners').select('status, id, is_privileged').eq('user_id', user.id).single(),
  ])

  if (profile?.role !== 'practitioner' && profile?.role !== 'admin') redirect('/')

  if (!practitioner || practitioner.status !== 'approved') {
    redirect('/practitioner/pending')
  }

  // 今日預約數、待確認預約數、未讀通知數
  const today = new Date().toISOString().split('T')[0]
  const [{ count: todayCount }, { count: pendingCount }, { count: unreadCount }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('practitioner_id', practitioner.id)
      .gte('created_at', today),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('practitioner_id', practitioner.id)
      .eq('status', 'pending'),
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false),
  ])

  const customerCount = practitioner.is_privileged ? null : await getPractitionerCustomerCount(supabase, practitioner.id)
  const subscribed = customerCount !== null && customerCount >= FREE_CUSTOMER_LIMIT
    ? await hasActiveSubscription(supabase, practitioner.id)
    : false

  const entries = [
    { href: '/practitioner/dashboard/profile/brand', icon: Sparkles, label: '品牌頁面', sublabel: '自訂老師公開頁面內容' },
    { href: '/practitioner/dashboard/services', icon: ListChecks, label: '服務管理', sublabel: '新增、編輯或刪除服務項目' },
    { href: '/practitioner/dashboard/availability', icon: Calendar, label: '時段管理', sublabel: '新增或移除可預約時段', indent: true },
    { href: '/practitioner/dashboard/bookings', icon: ClipboardList, label: '預約管理', sublabel: '查看並管理所有預約訂單', indent: true },
    { href: '/practitioner/dashboard/students', icon: Users, label: '學員列表', sublabel: '查看誰預約過我與歷史紀錄' },
    { href: '/practitioner/dashboard/analytics', icon: BarChart3, label: '數據分析', sublabel: '預約量與營收趨勢' },
    { href: '/practitioner/dashboard/profile', icon: UserCog, label: '會員中心', sublabel: '銀行帳戶、身份驗證、社群連結' },
    { href: '/practitioner/dashboard/reviews', icon: Star, label: '我的評價', sublabel: '查看學員對您的評價' },
  ]

  return (
    <div className="min-h-screen lg:min-h-0 bg-background">
      {/* 手機版專用頂部導覽，桌面版由 layout 共用頂部導覽取代 */}
      <nav className="lg:hidden sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo-icon.png" alt="職人連結" width={37} height={26} className="h-8 w-auto object-contain" />
          <span className="font-bold text-xl text-foreground">職人連結</span>
          <span className="ml-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">職人後台</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/practitioner/dashboard/notifications">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-4 h-4" />
              {!!unreadCount && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
              )}
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm">
              <Home className="w-4 h-4 mr-1.5" />回首頁
            </Button>
          </Link>
          <form action={signOut}>
            <Button variant="ghost" size="sm" type="submit">
              <LogOut className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </nav>

      <div className="px-4 py-6 lg:px-0 lg:py-0 max-w-lg lg:max-w-none mx-auto">
        <p className="text-muted-foreground text-sm mb-1">歡迎回來</p>
        <h1 className="text-2xl font-bold text-foreground mb-6">{profile?.display_name ?? '老師'}</h1>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link href="/practitioner/dashboard/bookings?today=1">
            <Card className="transition-colors hover:border-primary active:scale-[0.98]">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">今日預約</p>
                <p className="text-3xl font-bold text-primary mt-1">{todayCount ?? 0}</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/practitioner/dashboard/bookings?status=pending">
            <Card className="transition-colors hover:border-primary active:scale-[0.98]">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">待確認</p>
                <p className="text-3xl font-bold text-foreground mt-1">{pendingCount ?? 0}</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {customerCount !== null && (
          <Card className={`mb-6 ${
            customerCount >= FREE_CUSTOMER_LIMIT && !subscribed
              ? 'border-destructive bg-destructive/5'
              : customerCount >= FREE_CUSTOMER_LIMIT - 10
              ? 'border-amber-400 bg-amber-50'
              : ''
          }`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">客人數</p>
              <p className="text-2xl font-bold mb-2">
                {customerCount}
                <span className="text-sm font-normal text-muted-foreground"> / {FREE_CUSTOMER_LIMIT}</span>
              </p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full ${customerCount >= FREE_CUSTOMER_LIMIT && !subscribed ? 'bg-destructive' : customerCount >= FREE_CUSTOMER_LIMIT - 10 ? 'bg-amber-500' : 'bg-primary'}`}
                  style={{ width: `${Math.min(100, (customerCount / FREE_CUSTOMER_LIMIT) * 100)}%` }}
                />
              </div>
              {customerCount >= FREE_CUSTOMER_LIMIT && !subscribed ? (
                <>
                  <p className="text-xs text-destructive mb-2">新客人暫時無法預約你（已約過你的老客人不受影響）。訂閱即可繼續接新客。</p>
                  <p className="text-xs text-muted-foreground">訂閱方案：月費 NT$499（首月 NT$299，訂閱一年送一個月），請聯絡客服開通</p>
                </>
              ) : customerCount >= FREE_CUSTOMER_LIMIT - 10 ? (
                <p className="text-xs text-amber-700">只剩 {FREE_CUSTOMER_LIMIT - customerCount} 位新客人名額，快到免費上限了</p>
              ) : (
                <p className="text-xs text-muted-foreground">還可以再服務 {FREE_CUSTOMER_LIMIT - customerCount} 位新客人</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* 功能入口：桌面版已移至左側選單，這裡只在手機版顯示 */}
        <div className="lg:hidden">
          <SettingsListGroup>
            {entries.map((entry) => (
              <SettingsListItem
                key={entry.href}
                href={entry.href}
                icon={entry.icon}
                label={entry.label}
                sublabel={entry.sublabel}
                indent={'indent' in entry ? entry.indent : false}
              />
            ))}
          </SettingsListGroup>
        </div>
      </div>
    </div>
  )
}
