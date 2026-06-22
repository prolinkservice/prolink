'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { Plus, Trash2, User, MapPin, ClipboardList, CreditCard, Sparkles, ChevronLeft } from 'lucide-react'

type Service = { name: string; duration: number; price: number }

const STEP_NAMES = ['基本資料', '服務地點', '服務項目', '收款資料']

export default function PractitionerRegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1)

  const [form, setForm] = useState<{
    real_name: string
    bio: string
    service_mode: string
    shop_address: string
    license_url: string
    bank_name: string
    bank_account: string
    years_experience: string
    certificate_name: string
    specialty_tags: string
    cover_image_url: string
  }>({
    real_name: '',
    bio: '',
    service_mode: 'at_shop',
    shop_address: '',
    license_url: '',
    bank_name: '',
    bank_account: '',
    years_experience: '',
    certificate_name: '',
    specialty_tags: '',
    cover_image_url: '',
  })

  const [services, setServices] = useState<Service[]>([
    { name: '', duration: 60, price: 0 },
  ])

  const [geocoding, setGeocoding] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [existingPractitionerId, setExistingPractitionerId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push(`/auth?next=${encodeURIComponent('/practitioner/register')}`); return }

      const { data: rejected } = await supabase
        .from('practitioners')
        .select('id, bio, service_mode, shop_address, license_url, bank_name, bank_account, years_experience, certificate_name, specialty_tags, cover_image_url')
        .eq('user_id', user.id)
        .eq('status', 'rejected')
        .maybeSingle()

      if (rejected) {
        setExistingPractitionerId(rejected.id)

        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .single()

        setForm(f => ({
          ...f,
          real_name: profile?.display_name || f.real_name,
          bio: rejected.bio || '',
          service_mode: rejected.service_mode || 'at_shop',
          shop_address: rejected.shop_address || '',
          license_url: rejected.license_url || '',
          bank_name: rejected.bank_name || '',
          bank_account: rejected.bank_account || '',
          years_experience: rejected.years_experience !== null && rejected.years_experience !== undefined ? String(rejected.years_experience) : '',
          certificate_name: rejected.certificate_name || '',
          specialty_tags: (rejected.specialty_tags ?? []).join(', '),
          cover_image_url: rejected.cover_image_url || '',
        }))

        const { data: oldServices } = await supabase
          .from('services')
          .select('*')
          .eq('practitioner_id', rejected.id)

        if (oldServices && oldServices.length > 0) {
          setServices(oldServices.map(s => ({
            name: s.name,
            duration: s.duration_minutes,
            price: s.price,
          })))
        }
      }

      setCheckingAuth(false)
    })
  }, [router])

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
    } catch (err: unknown) {
      console.error('地址轉換失敗:', err)
      return null
    } finally {
      setGeocoding(false)
    }
  }

  function validateStep1(): string {
    if (!form.real_name.trim()) return '請填寫真實姓名'
    if (!form.bio.trim()) return '請填寫自我介紹'
    return ''
  }

  function validateStep2(): string {
    if (!form.service_mode) return '請選擇服務方式'
    if ((form.service_mode === 'at_shop' || form.service_mode === 'both') && !form.shop_address.trim()) {
      return '請填寫店面地址'
    }
    return ''
  }

  function validateStep3(): string {
    if (services.length === 0) return '請至少新增一筆服務項目'
    if (services.some(s => !s.name.trim() || s.price <= 0)) {
      return '請填寫所有服務項目的名稱與價格'
    }
    return ''
  }

  function goNext() {
    setError('')
    let msg = ''
    if (step === 1) msg = validateStep1()
    else if (step === 2) msg = validateStep2()
    else if (step === 3) msg = validateStep3()

    if (msg) {
      setError(msg)
      return
    }
    setStep(s => s + 1)
  }

  function goBack() {
    setError('')
    setStep(s => s - 1)
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

      let practitionerId: string

      if (existingPractitionerId) {
        // 補件重新申請：更新既有 practitioner 紀錄
        const { error: updateErr } = await supabase.from('practitioners').update({
          bio: form.bio,
          service_mode: form.service_mode,
          shop_address: form.shop_address || null,
          latitude,
          longitude,
          license_url: form.license_url || null,
          bank_name: form.bank_name || null,
          bank_account: form.bank_account || null,
          years_experience: form.years_experience ? parseInt(form.years_experience) : null,
          certificate_name: form.certificate_name || null,
          specialty_tags: form.specialty_tags ? form.specialty_tags.split(',').map(s => s.trim()).filter(Boolean) : [],
          cover_image_url: form.cover_image_url || null,
          status: 'pending',
          rejection_reason: null,
        }).eq('id', existingPractitionerId)

        if (updateErr) throw updateErr

        practitionerId = existingPractitionerId

        // 清除舊的服務項目，重新插入
        await supabase.from('services').delete().eq('practitioner_id', practitionerId)
      } else {
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
          years_experience: form.years_experience ? parseInt(form.years_experience) : null,
          certificate_name: form.certificate_name || null,
          specialty_tags: form.specialty_tags ? form.specialty_tags.split(',').map(s => s.trim()).filter(Boolean) : [],
          cover_image_url: form.cover_image_url || null,
          status: 'pending',
        }).select().single()

        if (pracErr) throw pracErr

        practitionerId = prac.id
      }

      // Insert services
      if (services.length > 0) {
        await supabase.from('services').insert(
          services.map(s => ({
            practitioner_id: practitionerId,
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
      console.error('職人入駐送出失敗:', err)
      const message = (err && typeof err === 'object' && 'message' in err)
        ? String((err as { message: unknown }).message)
        : '送出失敗，請再試一次'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">載入中...</div>
  }

  const BackButton = (
    <button
      type="button"
      aria-label="返回"
      className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted active:scale-90 transition-transform shrink-0"
    >
      <ChevronLeft className="w-5 h-5 text-foreground" />
    </button>
  )

  return (
    <div className="min-h-screen bg-background px-4 py-6 max-w-lg mx-auto">
      {/* Header：返回首頁 / 上一步 */}
      <div className="flex items-center mb-4">
        {step === 1 ? (
          <Link href="/">{BackButton}</Link>
        ) : (
          <button
            type="button"
            aria-label="返回上一步"
            onClick={goBack}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted active:scale-90 transition-transform shrink-0"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
        )}
      </div>

      {/* 進度條 */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground mb-2">
          步驟 {step}／4・{STEP_NAMES[step - 1]}
        </p>
        <div className="flex gap-1.5">
          {STEP_NAMES.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 flex-1 rounded-full ${idx + 1 <= step ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>
      </div>

      {/* 說明區塊 */}
      <div className="bg-gradient-to-br from-primary to-[#6FAE82] rounded-2xl p-5 text-white shadow-md mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5" />
          <h1 className="text-xl font-bold">職人入駐申請</h1>
        </div>
        <p className="text-white/80 text-sm leading-relaxed">
          填寫資料送出後，將由平台審核，通過後即可上架接單。請確保資料正確完整，以加快審核速度。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 基本資料 */}
        {step === 1 && (
        <Card className="rounded-2xl border border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-primary" />
              </span>
              基本資料
            </CardTitle>
          </CardHeader>
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
              <Label>執業年資（選填）</Label>
              <Input type="number" className="mt-1" placeholder="例：5" value={form.years_experience}
                onChange={e => setForm(f => ({ ...f, years_experience: e.target.value }))} min={0} />
            </div>
            <div>
              <Label>證照名稱（選填）</Label>
              <Input className="mt-1" placeholder="例：中醫推拿執照" value={form.certificate_name}
                onChange={e => setForm(f => ({ ...f, certificate_name: e.target.value }))} />
            </div>
            <div>
              <Label>證照圖片網址（選填）</Label>
              <Input className="mt-1" placeholder="https://..." value={form.license_url}
                onChange={e => setForm(f => ({ ...f, license_url: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Demo 階段請貼上圖片連結</p>
            </div>
            <div>
              <Label>專長標籤（選填，用逗號分隔）</Label>
              <Input className="mt-1" placeholder="例：運動按摩, 深層組織按摩, 久坐族群調理" value={form.specialty_tags}
                onChange={e => setForm(f => ({ ...f, specialty_tags: e.target.value }))} />
            </div>
            <div>
              <Label>封面照網址（選填）</Label>
              <Input className="mt-1" placeholder="https://..." value={form.cover_image_url}
                onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">建議使用寬幅橫向照片，Demo 階段請貼上圖片連結</p>
            </div>
          </CardContent>
        </Card>
        )}

        {/* 服務地點 */}
        {step === 2 && (
        <Card className="rounded-2xl border border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-primary" />
              </span>
              服務地點
            </CardTitle>
          </CardHeader>
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
                    className={`px-3 py-1.5 rounded-full text-sm border transition-all active:scale-95 ${
                      form.service_mode === opt.value
                        ? 'bg-primary text-white border-primary shadow-sm'
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
        )}

        {/* 服務項目 */}
        {step === 3 && (
        <Card className="rounded-2xl border border-border shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <ClipboardList className="w-4 h-4 text-primary" />
                </span>
                服務項目
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addService} className="active:scale-95 transition-transform">
                <Plus className="w-3 h-3 mr-1" />新增
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {services.map((s, i) => (
              <div key={i} className="bg-white border border-border rounded-xl p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">項目 {i + 1}</span>
                  {services.length > 1 && (
                    <button type="button" onClick={() => removeService(i)} className="text-destructive hover:opacity-70 active:scale-90 transition-transform">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div>
                  <Label className="text-xs">服務名稱</Label>
                  <Input className="mt-1" placeholder="例：全身按摩" value={s.name}
                    onChange={e => updateService(i, 'name', e.target.value)} required />
                </div>
                <div className="flex gap-3">
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
        )}

        {/* 銀行資料 */}
        {step === 4 && (
        <Card className="rounded-2xl border border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4 text-primary" />
              </span>
              收款資料（選填）
            </CardTitle>
          </CardHeader>
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
        )}

        {error && (
          <p className="text-destructive text-sm text-center bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              className="flex-1 active:scale-95 transition-transform"
              size="lg"
              onClick={goBack}
            >
              ← 上一步
            </Button>
          )}

          {step < 4 ? (
            <Button
              type="button"
              className="flex-1 active:scale-95 transition-transform"
              size="lg"
              onClick={goNext}
            >
              下一步 →
            </Button>
          ) : (
            <Button
              type="submit"
              className="flex-1 active:scale-95 transition-transform"
              size="lg"
              disabled={loading}
            >
              {loading ? '送出中...' : '送出審核申請'}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
