'use client'

import { useEffect, useState } from 'react'
import { MapPin, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { revalidateAddress } from '../actions'

interface AddressData {
  shop_address: string | null
  latitude: number | null
  longitude: number | null
}

export function AddressForm() {
  const [data, setData] = useState<AddressData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: practitioner } = await supabase
        .from('practitioners')
        .select('shop_address, latitude, longitude')
        .eq('user_id', user.id)
        .single()
      setData(practitioner as AddressData)
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !data) {
    return <p className="text-muted-foreground text-sm text-center py-8">載入中...</p>
  }

  const addressVerified = data.latitude !== null && data.longitude !== null

  return (
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
          <Input name="shopAddress" defaultValue={data.shop_address ?? ''} placeholder="請輸入完整地址" />
          <Button type="submit" size="sm" className="self-start active:scale-95 transition-transform">
            更新並重新驗證
          </Button>
          <p className="text-xs text-muted-foreground">系統會自動將地址轉換為地圖座標</p>
        </form>
      </CardContent>
    </Card>
  )
}
