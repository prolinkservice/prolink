import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { signOut } from '@/app/auth/actions'
import { AdminSideNav } from '@/components/AdminSideNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  return (
    <div className="min-h-screen bg-[#F8F7F5]">
      <nav className="sticky top-0 z-50 bg-white border-b border-border shadow-sm px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <div>
            <span className="font-bold text-base text-foreground">職人連結</span>
            <span className="ml-2 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">管理後台</span>
          </div>
        </Link>
        <form action={signOut}>
          <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground">
            <LogOut className="w-4 h-4 mr-1.5" />登出
          </Button>
        </form>
      </nav>

      <div className="lg:flex lg:items-start">
        <div className="mb-6 lg:mb-0 lg:shrink-0 lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)]">
          <AdminSideNav />
        </div>
        <div className="flex-1 min-w-0 px-4 py-6 lg:px-6">{children}</div>
      </div>
    </div>
  )
}
