import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { PLATFORM_COMMISSION_RATE } from '@/lib/commission'
import { DailyBarChart } from './DailyBarChart'

const DAYS = 30

export default async function AnalyticsPage() {
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

  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - (DAYS - 1))
  sinceDate.setHours(0, 0, 0, 0)

  // 只算狀態為 confirmed/completed 的預約（pending/cancelled 不計入營收與預約量統計）
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, status, created_at, total_amount, services ( price )')
    .eq('practitioner_id', practitioner.id)
    .in('status', ['confirmed', 'completed'])
    .gte('created_at', sinceDate.toISOString())
    .order('created_at', { ascending: true })

  // 依日期分組：每日預約數＋老師實收金額（扣除平台 10% 抽成後）
  const dayBuckets = new Map<string, { count: number; payout: number }>()
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(sinceDate)
    d.setDate(d.getDate() + i)
    const key = d.toISOString().split('T')[0]
    dayBuckets.set(key, { count: 0, payout: 0 })
  }

  let totalCount = 0
  let totalPayout = 0

  for (const b of bookings ?? []) {
    const service = Array.isArray(b.services) ? b.services[0] : b.services
    const price = service?.price ?? b.total_amount ?? 0
    const payout = Math.round(price * (1 - PLATFORM_COMMISSION_RATE))

    // 用台灣時區判斷日期分組
    const taipei = new Date(new Date(b.created_at).getTime() + 8 * 60 * 60 * 1000)
    const key = taipei.toISOString().split('T')[0]

    const bucket = dayBuckets.get(key)
    if (bucket) {
      bucket.count += 1
      bucket.payout += payout
    }
    totalCount += 1
    totalPayout += payout
  }

  const chartData = Array.from(dayBuckets.entries()).map(([date, v]) => ({
    date,
    count: v.count,
    payout: v.payout,
  }))

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/practitioner/dashboard">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4" />
          數據分析
        </span>
      </nav>

      <div className="px-4 py-6 max-w-lg lg:max-w-2xl mx-auto">
        <p className="text-xs text-muted-foreground mb-4">
          僅統計「已確認」與「已完成」的預約，金額為扣除平台服務費（{PLATFORM_COMMISSION_RATE * 100}%）後的老師實收金額
        </p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">近 {DAYS} 天預約數</p>
              <p className="text-3xl font-bold text-primary mt-1">{totalCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">近 {DAYS} 天實收金額</p>
              <p className="text-2xl font-bold text-foreground mt-1">NT${totalPayout.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        <DailyBarChart data={chartData} />
      </div>
    </div>
  )
}
