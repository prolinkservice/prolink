import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, MapPin, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { revalidateAddress } from '../actions'

export default async function ShopAddressPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('shop_address, latitude, longitude')
    .eq('user_id', user.id)
    .single()

  if (!practitioner) redirect('/')

  const addressVerified = practitioner.latitude !== null && practitioner.longitude !== null

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/practitioner/dashboard/profile">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold text-lg">店家地址</span>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              店家地址
            </CardTitle>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${
              addressVerified ? 'text-green-600 bg-green-50 border-green-200' : 'text-amber-600 bg-amber-50 border-amber-200'
            }`}>
              {addressVerified ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {addressVerified ? '已驗證' : '尚未驗證'}
            </span>
          </CardHeader>
          <CardContent>
            <form action={revalidateAddress} className="flex flex-col gap-3">
              <Input name="shopAddress" defaultValue={practitioner.shop_address ?? ''} placeholder="請輸入完整地址" />
              <Button type="submit" size="sm" className="self-start active:scale-95 transition-transform">
                更新並重新驗證
              </Button>
              <p className="text-xs text-muted-foreground">系統會自動將地址轉換為地圖座標</p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
