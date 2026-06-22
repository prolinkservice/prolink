'use client'

import { useEffect, useState } from 'react'
import { MapPin, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import GoogleMap from '@/components/GoogleMap'
import { updateAddress } from '../actions'

interface AddressData {
  shop_address: string | null
  latitude: number | null
  longitude: number | null
}

export function AddressForm() {
  const [data, setData] = useState<AddressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
      const p = practitioner as AddressData | null
      setData(p)
      setAddress(p?.shop_address ?? '')
      if (p?.latitude !== null && p?.longitude !== null && p?.latitude !== undefined && p?.longitude !== undefined) {
        setCoords({ lat: p.latitude, lng: p.longitude })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleGeocode() {
    if (!address.trim()) return
    setGeocoding(true)
    setGeocodeError(null)
    setSaved(false)
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      )
      const result = await res.json()
      if (result.status === 'OK') {
        const loc = result.results[0].geometry.location
        setCoords({ lat: loc.lat, lng: loc.lng })
      } else {
        setCoords(null)
        setGeocodeError('找不到這個地址，請確認輸入是否正確')
      }
    } catch (err) {
      console.error(err)
      setCoords(null)
      setGeocodeError('地址轉換失敗，請再試一次')
    } finally {
      setGeocoding(false)
    }
  }

  async function handleSubmit(formData: FormData) {
    setSaving(true)
    try {
      await updateAddress(formData)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !data) {
    return <p className="text-muted-foreground text-sm text-center py-8">載入中...</p>
  }

  const addressVerified = saved ? coords !== null : data.latitude !== null && data.longitude !== null

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
        <form action={handleSubmit} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              name="shopAddress"
              value={address}
              onChange={(e) => { setAddress(e.target.value); setSaved(false) }}
              placeholder="請輸入完整地址"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={geocoding || !address.trim()}
              onClick={handleGeocode}
              className="active:scale-95 transition-transform shrink-0"
            >
              {geocoding ? '查詢中...' : '在地圖上預覽'}
            </Button>
          </div>
          {geocodeError && <p className="text-xs text-destructive">{geocodeError}</p>}

          {coords && (
            <div className="w-full h-56 rounded-xl overflow-hidden border border-border">
              <GoogleMap practitioners={[{ id: 'preview', name: address, lat: coords.lat, lng: coords.lng }]} />
            </div>
          )}

          <input type="hidden" name="latitude" value={coords?.lat ?? ''} />
          <input type="hidden" name="longitude" value={coords?.lng ?? ''} />

          <Button
            type="submit"
            size="sm"
            disabled={saving || !coords}
            className="self-start active:scale-95 transition-transform"
          >
            {saving ? '儲存中...' : '儲存地址'}
          </Button>
          <p className="text-xs text-muted-foreground">請先點「在地圖上預覽」確認位置正確後再儲存</p>
        </form>
      </CardContent>
    </Card>
  )
}
