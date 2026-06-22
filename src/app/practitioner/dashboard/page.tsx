import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, ClipboardList, LogOut, UserCog, Star } from 'lucide-react'
import { signOut } from '@/app/auth/actions'

export default async function PractitionerDashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'practitioner' && profile?.role !== 'admin') redirect('/')

  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('status, id')
    .eq('user_id', user.id)
    .single()

  if (!practitioner || practitioner.status !== 'approved') {
    redirect('/practitioner/pending')
  }

  // 今日預約數
  const today = new Date().toISOString().split('T')[0]
  const { count: todayCount } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('practitioner_id', practitioner.id)
    .gte('created_at', today)

  // 待確認預約數
  const { count: pendingCount } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('practitioner_id', practitioner.id)
    .eq('status', 'pending')

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="font-bold text-xl text-foreground">ProLink 職人後台</span>
        </div>
        <form action={signOut}>
          <Button variant="ghost" size="sm" type="submit">
            <LogOut className="w-4 h-4" />
          </Button>
        </form>
      </nav>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <p className="text-muted-foreground text-sm mb-1">歡迎回來</p>
        <h1 className="text-2xl font-bold text-foreground mb-6">{profile?.display_name ?? '老師'}</h1>

        {/* 統計卡片 */}
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

        {/* 功能入口 */}
        <div className="space-y-3">
          <Link href="/practitioner/dashboard/availability">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">時段管理</p>
                  <p className="text-xs text-muted-foreground">新增或移除可預約時段</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/practitioner/dashboard/bookings">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
                  <ClipboardList className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">預約管理</p>
                  <p className="text-xs text-muted-foreground">查看並管理所有預約訂單</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/practitioner/dashboard/profile">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
                  <UserCog className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">會員中心</p>
                  <p className="text-xs text-muted-foreground">銀行帳戶、身份驗證、社群連結</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/practitioner/dashboard/reviews">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
                  <Star className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">我的評價</p>
                  <p className="text-xs text-muted-foreground">查看學員對您的評價</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}
