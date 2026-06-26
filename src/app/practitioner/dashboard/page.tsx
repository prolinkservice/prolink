import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, ClipboardList, LogOut, UserCog, Star, Home, ListChecks, Bell, Users, BarChart3 } from 'lucide-react'
import { signOut } from '@/app/auth/actions'
import { SettingsListGroup, SettingsListItem } from '@/components/SettingsListItem'

export default async function PractitionerDashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [{ data: profile }, { data: practitioner }] = await Promise.all([
    supabase.from('profiles').select('display_name, role').eq('id', user.id).single(),
    supabase.from('practitioners').select('status, id').eq('user_id', user.id).single(),
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

  const entries = [
    { href: '/practitioner/dashboard/availability', icon: Calendar, label: '時段管理', sublabel: '新增或移除可預約時段' },
    { href: '/practitioner/dashboard/services', icon: ListChecks, label: '服務管理', sublabel: '新增、編輯或刪除服務項目' },
    { href: '/practitioner/dashboard/bookings', icon: ClipboardList, label: '預約管理', sublabel: '查看並管理所有預約訂單' },
    { href: '/practitioner/dashboard/students', icon: Users, label: '學員列表', sublabel: '查看誰預約過我與歷史紀錄' },
    { href: '/practitioner/dashboard/analytics', icon: BarChart3, label: '數據分析', sublabel: '預約量與營收趨勢' },
    { href: '/practitioner/dashboard/profile', icon: UserCog, label: '會員中心', sublabel: '銀行帳戶、身份驗證、社群連結' },
    { href: '/practitioner/dashboard/reviews', icon: Star, label: '我的評價', sublabel: '查看學員對您的評價' },
  ]

  return (
    <div className="min-h-screen lg:min-h-0 bg-background">
      {/* 手機版專用頂部導覽，桌面版由 layout 共用頂部導覽取代 */}
      <nav className="lg:hidden sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="font-bold text-xl text-foreground">ProLink 職人後台</span>
        </div>
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
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">今日預約</p>
              <p className="text-3xl font-bold text-primary mt-1">{todayCount ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">待確認</p>
              <p className="text-3xl font-bold text-foreground mt-1">{pendingCount ?? 0}</p>
            </CardContent>
          </Card>
        </div>

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
              />
            ))}
          </SettingsListGroup>
        </div>
      </div>
    </div>
  )
}
