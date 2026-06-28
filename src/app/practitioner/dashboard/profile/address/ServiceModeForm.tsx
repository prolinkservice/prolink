'use client'

import { useEffect, useState } from 'react'
import { Building2, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { updateServiceMode } from '../actions'

export function ServiceModeForm() {
  const [loading, setLoading] = useState(true)
  const [atShop, setAtShop] = useState(true)
  const [onSite, setOnSite] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: practitioner } = await supabase
        .from('practitioners')
        .select('service_mode')
        .eq('user_id', user.id)
        .single()
      const mode = practitioner?.service_mode
      setAtShop(mode === 'at_shop' || mode === 'both')
      setOnSite(mode === 'on_site' || mode === 'both')
      setLoading(false)
    }
    load()
  }, [])

  function toggle(which: 'atShop' | 'onSite') {
    setError('')
    setSaved(false)
    if (which === 'atShop') {
      if (atShop && !onSite) {
        setError('至少要保留一種服務方式，老師才能被預約')
        return
      }
      setAtShop((v) => !v)
    } else {
      if (onSite && !atShop) {
        setError('至少要保留一種服務方式，老師才能被預約')
        return
      }
      setOnSite((v) => !v)
    }
  }

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const formData = new FormData()
      if (atShop) formData.set('atShop', 'on')
      if (onSite) formData.set('onSite', 'on')
      await updateServiceMode(formData)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm text-center py-8">載入中...</p>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">服務方式</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground -mt-1">
          關閉後，客人在預約時就不會看到該選項；已成立的預約不受影響
        </p>

        <button
          type="button"
          onClick={() => toggle('atShop')}
          className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-all ${
            atShop ? 'border-primary bg-primary/5' : 'border-border'
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">到店服務</p>
            <p className="text-xs text-muted-foreground">客人到你的店家地址接受服務</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${atShop ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
            {atShop ? '開啟' : '關閉'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => toggle('onSite')}
          className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-all ${
            onSite ? 'border-primary bg-primary/5' : 'border-border'
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">到府服務</p>
            <p className="text-xs text-muted-foreground">你親自前往客人指定地址服務</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${onSite ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
            {onSite ? '開啟' : '關閉'}
          </span>
        </button>

        {error && <p className="text-destructive text-sm">{error}</p>}
        {saved && <p className="text-green-600 text-sm">已更新</p>}

        <Button onClick={handleSubmit} disabled={saving} className="self-start active:scale-95 transition-transform">
          {saving ? '儲存中...' : '儲存服務方式'}
        </Button>
      </CardContent>
    </Card>
  )
}
