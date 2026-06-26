import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { StudentList } from './StudentList'
import { BrandMark } from '@/components/BrandMark'

const STATUS_LABEL: Record<string, string> = {
  pending: '待確認',
  confirmed: '已確認',
  completed: '已完成',
  cancelled: '已取消',
}

export interface StudentBooking {
  id: string
  status: string
  created_at: string
  serviceName: string | null
  startTime: string | null
}

export interface Student {
  customerId: string
  displayName: string
  avatarUrl: string | null
  bookingCount: number
  lastBookingAt: string
  bookings: StudentBooking[]
}

export default async function StudentsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('id, status')
    .eq('user_id', user.id)
    .single()

  if (!practitioner || practitioner.status !== 'approved') {
    redirect('/practitioner/pending')
  }

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, customer_id, status, created_at,
      profiles ( display_name, avatar_url ),
      services ( name ),
      availability_slots ( start_time )
    `)
    .eq('practitioner_id', practitioner.id)
    .order('created_at', { ascending: false })

  // 依 customer_id 去重整理成學員列表
  const studentMap = new Map<string, Student>()

  for (const b of bookings ?? []) {
    const profile = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles
    const service = Array.isArray(b.services) ? b.services[0] : b.services
    const slot = Array.isArray(b.availability_slots) ? b.availability_slots[0] : b.availability_slots

    const bookingEntry: StudentBooking = {
      id: b.id,
      status: b.status,
      created_at: b.created_at,
      serviceName: service?.name ?? null,
      startTime: slot?.start_time ?? null,
    }

    const existing = studentMap.get(b.customer_id)
    if (existing) {
      existing.bookingCount += 1
      existing.bookings.push(bookingEntry)
    } else {
      studentMap.set(b.customer_id, {
        customerId: b.customer_id,
        displayName: profile?.display_name ?? '顧客',
        avatarUrl: profile?.avatar_url ?? null,
        bookingCount: 1,
        lastBookingAt: b.created_at,
        bookings: [bookingEntry],
      })
    }
  }

  // 依最近預約時間排序（bookings 本身已依 created_at desc 排序，第一筆即最新）
  const students = Array.from(studentMap.values()).sort(
    (a, b) => new Date(b.lastBookingAt).getTime() - new Date(a.lastBookingAt).getTime()
  )

  return (
    <div className="min-h-screen bg-background">
      <nav className="lg:hidden sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/practitioner/dashboard">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          學員列表
        </span>
        <BrandMark />
      </nav>

      <div className="px-4 py-6 max-w-lg lg:max-w-2xl mx-auto">
        {students.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-12">
            目前還沒有學員預約過您的服務
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              共 {students.length} 位學員預約過您的服務
            </p>
            <StudentList students={students} statusLabel={STATUS_LABEL} />
          </>
        )}
      </div>
    </div>
  )
}
