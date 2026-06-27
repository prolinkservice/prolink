import { createServerSupabaseClient } from '@/lib/supabase-server'
import { parseCity } from '@/lib/address'
import { PLATFORM_COMMISSION_RATE } from '@/lib/commission'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SignupTrendChart } from './SignupTrendChart'

const GENDER_LABEL: Record<string, string> = {
  male: '男性',
  female: '女性',
  other: '其他',
}

function calcAge(birthdate: string) {
  const today = new Date()
  const d = new Date(birthdate)
  let age = today.getFullYear() - d.getFullYear()
  const monthDiff = today.getMonth() - d.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) age--
  return age
}

function ageBracket(age: number) {
  if (age < 20) return '20歲以下'
  if (age < 30) return '20-29歲'
  if (age < 40) return '30-39歲'
  if (age < 50) return '40-49歲'
  if (age < 60) return '50-59歲'
  return '60歲以上'
}

function BreakdownBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">{count} 人（{pct}%）</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default async function AdminAnalyticsPage() {
  const supabase = await createServerSupabaseClient()

  const [{ data: customers }, { data: bookings }, { count: practitionerCount }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, gender, birthdate, created_at')
      .eq('role', 'customer'),
    supabase
      .from('bookings')
      .select(`
        id, customer_id, status, payment_status, total_amount, deposit_amount, customer_address, created_at,
        services ( category ),
        practitioners ( shop_address )
      `),
    supabase
      .from('practitioners')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved'),
  ])

  const customerList = customers ?? []
  const bookingList = bookings ?? []
  const totalCustomers = customerList.length

  // 性別分布
  const genderCounts = { male: 0, female: 0, other: 0, unknown: 0 }
  // 年齡分布
  const ageCounts: Record<string, number> = {}
  for (const c of customerList) {
    if (c.gender && c.gender in genderCounts) {
      genderCounts[c.gender as 'male' | 'female' | 'other']++
    } else {
      genderCounts.unknown++
    }
    if (c.birthdate) {
      const bracket = ageBracket(calcAge(c.birthdate))
      ageCounts[bracket] = (ageCounts[bracket] ?? 0) + 1
    }
  }
  const filledDemographics = totalCustomers - genderCounts.unknown
  const ageFilledCount = Object.values(ageCounts).reduce((a, b) => a + b, 0)
  const ageOrder = ['20歲以下', '20-29歲', '30-39歲', '40-49歲', '50-59歲', '60歲以上']

  // 地區分布（到府用客人地址，到店用老師店家地址推估客人所在區域）
  const regionCounts: Record<string, number> = {}
  for (const b of bookingList) {
    const practitionerRaw = b.practitioners as unknown
    const practitioner = Array.isArray(practitionerRaw) ? practitionerRaw[0] : practitionerRaw
    const shopAddress = (practitioner as { shop_address?: string } | null)?.shop_address
    const city = parseCity(b.customer_address) ?? parseCity(shopAddress)
    if (city) regionCounts[city] = (regionCounts[city] ?? 0) + 1
  }
  const topRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const totalRegionBookings = Object.values(regionCounts).reduce((a, b) => a + b, 0)

  // 熱門服務分類
  const categoryCounts: Record<string, number> = {}
  for (const b of bookingList) {
    const serviceRaw = b.services as unknown
    const service = Array.isArray(serviceRaw) ? serviceRaw[0] : serviceRaw
    const category = (service as { category?: string } | null)?.category
    if (category) categoryCounts[category] = (categoryCounts[category] ?? 0) + 1
  }
  const topCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)

  // 回購率：confirmed/completed 預約 >=2 筆的客人佔比
  const validBookingsByCustomer: Record<string, number> = {}
  for (const b of bookingList) {
    if (b.status === 'confirmed' || b.status === 'completed') {
      validBookingsByCustomer[b.customer_id] = (validBookingsByCustomer[b.customer_id] ?? 0) + 1
    }
  }
  const customersWithBooking = Object.keys(validBookingsByCustomer).length
  const repeatCustomers = Object.values(validBookingsByCustomer).filter((n) => n >= 2).length
  const repeatRate = customersWithBooking > 0 ? Math.round((repeatCustomers / customersWithBooking) * 100) : 0

  // 近30天每日新會員數／預約數／平台服務費收入趨勢
  const days: { date: string; signups: number; bookings: number; revenue: number }[] = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    days.push({ date: dateStr, signups: 0, bookings: 0, revenue: 0 })
  }
  const dayIndex: Record<string, number> = {}
  days.forEach((d, i) => { dayIndex[d.date] = i })

  for (const c of customerList) {
    const dateStr = c.created_at?.split('T')[0]
    if (dateStr && dateStr in dayIndex) days[dayIndex[dateStr]].signups++
  }
  for (const b of bookingList) {
    const dateStr = b.created_at?.split('T')[0]
    if (dateStr && dateStr in dayIndex) {
      days[dayIndex[dateStr]].bookings++
      if (b.payment_status === 'paid' || b.payment_status === 'partially_paid') {
        days[dayIndex[dateStr]].revenue += Math.round((b.deposit_amount ?? b.total_amount * PLATFORM_COMMISSION_RATE) || 0)
      }
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-bold text-xl text-foreground">使用分析報表</h1>

      {/* 總覽卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">會員總數</p>
          <p className="text-2xl font-bold text-foreground mt-1">{totalCustomers}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">已上架職人</p>
          <p className="text-2xl font-bold text-foreground mt-1">{practitionerCount ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">總預約數</p>
          <p className="text-2xl font-bold text-foreground mt-1">{bookingList.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">回購率（≥2次預約）</p>
          <p className="text-2xl font-bold text-primary mt-1">{repeatRate}%</p>
        </CardContent></Card>
      </div>

      {/* 近30天趨勢 */}
      <SignupTrendChart data={days} />

      <div className="grid lg:grid-cols-2 gap-4">
        {/* 性別分布 */}
        <Card>
          <CardHeader><CardTitle className="text-base">性別分布</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground -mt-1">已填寫 {filledDemographics} / {totalCustomers} 人</p>
            <BreakdownBar label="男性" count={genderCounts.male} total={totalCustomers} />
            <BreakdownBar label="女性" count={genderCounts.female} total={totalCustomers} />
            <BreakdownBar label="其他" count={genderCounts.other} total={totalCustomers} />
            <BreakdownBar label="未填寫" count={genderCounts.unknown} total={totalCustomers} />
          </CardContent>
        </Card>

        {/* 年齡分布 */}
        <Card>
          <CardHeader><CardTitle className="text-base">年齡分布</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground -mt-1">已填寫 {ageFilledCount} / {totalCustomers} 人</p>
            {ageFilledCount === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">尚無使用者填寫生日資料</p>
            ) : (
              ageOrder.map((bracket) => (
                <BreakdownBar key={bracket} label={bracket} count={ageCounts[bracket] ?? 0} total={ageFilledCount} />
              ))
            )}
          </CardContent>
        </Card>

        {/* 地區分布 */}
        <Card>
          <CardHeader><CardTitle className="text-base">客戶地區分布（依預約推估）</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {topRegions.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">尚無可推估地區的預約資料</p>
            ) : (
              topRegions.map(([city, count]) => (
                <BreakdownBar key={city} label={city} count={count} total={totalRegionBookings} />
              ))
            )}
          </CardContent>
        </Card>

        {/* 熱門服務分類 */}
        <Card>
          <CardHeader><CardTitle className="text-base">熱門服務分類</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {topCategories.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">尚無分類資料</p>
            ) : (
              topCategories.map(([category, count]) => (
                <BreakdownBar key={category} label={category} count={count} total={bookingList.length} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
