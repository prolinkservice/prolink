import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Button } from '@/components/ui/button'
import { Bell, Home, LogOut } from 'lucide-react'
import { signOut } from '@/app/auth/actions'
import { DashboardSideNav } from '@/components/DashboardSideNav'

export default async function PractitionerDashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  return (
    <div className="min-h-screen bg-background">
      <nav className="hidden lg:flex sticky top-0 z-50 bg-white border-b border-border px-4 py-3 items-center justify-between shadow-sm">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo-icon.png" alt="職人連結" width={32} height={32} className="w-8 h-8 rounded-full object-cover" />
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

      <div className="lg:flex lg:items-start">
        <div className="hidden lg:block lg:shrink-0 lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)]">
          <DashboardSideNav />
        </div>
        <div className="flex-1 min-w-0 lg:px-6 lg:py-6">{children}</div>
      </div>
    </div>
  )
}
