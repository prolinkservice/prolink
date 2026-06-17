'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { Plus, Trash2 } from 'lucide-react'

type Service = { name: string; duration: number; price: number }

export default function PractitionerRegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<{
    real_name: string
    bio: string
    service_mode: string
    shop_address: string
    license_url: string
    bank_name: string
    bank_account: string
  }>({
    real_name: '',
    bio: '',
    service_mode: 'at_shop',
    shop_address: '',
    license_url: '',
    bank_name: '',
    bank_account: '',
  })

  const [services, setServices] = useState<Service[]>([
    { name: '', duration: 60, price: 0 },
  ])

  const [geocoding, setGeocoding] = useState(false)

  function updateService(i: number, field: keyof Service, value: string | number) {
    setServices(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  function addService() {
    setServices(prev => [...prev, { name: '', duration: 60, price: 0 }])
  }

  function removeService(i: number) {
    setServices(prev => prev.filter((_, idx) => idx !== i))
  }

  async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    if (!address) return null
    setGeocoding(true)
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      )
      const data = await res.json()
      if (data.status === 'OK') {
        const loc = data.results[0].geometry.location
        return { lat: loc.lat, lng: loc.lng }
      }
      return null
    } finally {
      setGeocoding(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (services.some(s => !s.name || s.price <= 0)) {
      setError('請填寫所有服務項目的名稱與價格')
      return
    }

    setLoading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      // Geocode address
      let latitude: number | null = null
      let longitude: number | null = null
      if (form.shop_address) {
        const coords = await geocodeAddress(form.shop_address)
        if (coords) { latitude = coords.lat; longitude = coords.lng }
      }

      // Update display_name in profiles
      await supabase.from('profiles').update({ display_name: form.real_name }).eq('id', user.id)

      // Insert practitioner record
      const { data: prac, error: pracErr } = await supabase.from('practitioners').insert({
        user_id: user.id,
        bio: form.bio,
        service_mode: form.service_mode,
        shop_address: form.shop_address || null,
        latitude,
        longitude,
        license_url: form.license_url || null,
        bank_name: form.bank_name || null,
        bank_account: form.bank_account || null,
        status: 'pending',
      }).select().single()

      if (pracErr) throw pracErr

      // Insert services
      if (services.length > 0) {
        await supabase.from('services').insert(
          services.map(s => ({
            practitioner_id: prac.id,
            name: s.name,
            duration_minutes: s.duration,
            price: s.price,
          }))
        )
      }

      // Update role to practitioner
      await supabase.from('profiles').update({ role: 'practitioner' }).eq('id', user.id)

      router.push('/practitioner/pending')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '送出失敗，請再試一次')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">職人入駐申請</h1>
        <p className="text-muted-foreground text-sm mt-1">填寫完成後送出審核，通過後即可上架接單</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 基本資料 */}
        <Card>
          <CardHeader><CardTitle className="text-base">基本資料</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>真實姓名 *</Label>
              <Input className="mt-1" placeholder="王小明" value={form.real_name}
                onChange={e => setForm(f => ({ ...f, real_name: e.target.value }))} required />
            </div>
            <div>
              <Label>自我介紹 *</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="請介紹您的專業背景、服務特色..."
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label>證照圖片網址（選填）</Label>
              <Input className="mt-1" placeholder="https://..." value={form.license_url}
                onChange={e => setForm(f => ({ ...f, license_url: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Demo 階段請貼上圖片連結</p>
            </div>
          </CardContent>
        </Card>

        {/* 服務地點 */}
        <Card>
          <CardHeader><CardTitle className="text-base">服務地點</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>服務方式 *</Label>
              <div className="flex gap-2 mt-1">
                {[
                  { value: 'at_shop', label: '到店' },
                  { value: 'on_site', label: '到府' },
                  { value: 'both', label: '兩者皆提供' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, service_mode: opt.value }))}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      form.service_mode === opt.value
                        ? 'bg-primary text-white border-primary'
                        : 'border-input text-foreground hover:border-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {(form.service_mode === 'at_shop' || form.service_mode === 'both') && (
              <div>
                <Label>店面地址 *</Label>
                <Input className="mt-1" placeholder="台北市大安區忠孝東路四段1號"
                  value={form.shop_address}
                  onChange={e => setForm(f => ({ ...f, shop_address: e.target.value }))}
                  required={(form.service_mode as string) !== 'on_site'}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {geocoding ? '地址轉換中...' : '此地址將顯示於地圖上'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 服務項目 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">服務項目</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addService}>
                <Plus className="w-3 h-3 mr-1" />新增
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {services.map((s, i) => (
              <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">項目 {i + 1}</span>
                  {services.length > 1 && (
                    <button type="button" onClick={() => removeService(i)} className="text-destructive hover:opacity-70">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <Input placeholder="服務名稱（例：全身按摩）" value={s.name}
                  onChange={e => updateService(i, 'name', e.target.value)} required />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">時長（分鐘）</Label>
                    <Input type="number" className="mt-1" value={s.duration}
                      onChange={e => updateService(i, 'duration', Number(e.target.value))} min={15} step={15} />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">價格（NT$）</Label>
                    <Input type="number" className="mt-1" value={s.price}
                      onChange={e => updateService(i, 'price', Number(e.target.value))} min={1} />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 銀行資料 */}
        <Card>
          <CardHeader><CardTitle className="text-base">收款資料（選填）</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>銀行名稱</Label>
              <Input className="mt-1" placeholder="台灣銀行" value={form.bank_name}
                onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} />
            </div>
            <div>
              <Label>銀行帳號</Label>
              <Input className="mt-1" placeholder="000-00000000" value={form.bank_account}
                onChange={e => setForm(f => ({ ...f, bank_account: e.target.value }))} />
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-destructive text-sm text-center">{error}</p>}

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? '送出中...' : '送出審核申請'}
        </Button>
      </form>
    </div>
  )
}
