'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { ArrowLeft, Plus, Trash2, Pencil, X } from 'lucide-react'
import Link from 'next/link'
import { SERVICE_CATEGORIES } from '@/lib/categories'

type Service = { id: string; name: string; duration_minutes: number; price: number; description: string | null; category: string | null }

export default function ServicesPage() {
  const router = useRouter()
  const [practitionerId, setPractitionerId] = useState<string | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('60')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(SERVICE_CATEGORIES[0].value)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data } = await supabase
        .from('practitioners')
        .select('id, status')
        .eq('user_id', user.id)
        .single()
      if (!data || data.status !== 'approved') { router.push('/practitioner/pending'); return }
      setPractitionerId(data.id)
      setLoading(false)
    })
  }, [router])

  const fetchServices = useCallback(async () => {
    if (!practitionerId) return
    const supabase = createBrowserSupabaseClient()
    const { data } = await supabase
      .from('services')
      .select('id, name, duration_minutes, price, description, category')
      .eq('practitioner_id', practitionerId)
      .order('duration_minutes')
    setServices(data ?? [])
  }, [practitionerId])

  useEffect(() => { fetchServices() }, [fetchServices])

  function resetForm() {
    setEditingId(null)
    setName('')
    setDuration('60')
    setPrice('')
    setDescription('')
    setCategory(SERVICE_CATEGORIES[0].value)
    setShowForm(false)
  }

  function startEdit(service: Service) {
    setEditingId(service.id)
    setName(service.name)
    setDuration(String(service.duration_minutes))
    setPrice(String(service.price))
    setDescription(service.description ?? '')
    setCategory(service.category ?? SERVICE_CATEGORIES[0].value)
    setShowForm(true)
  }

  async function saveService() {
    if (!practitionerId || !name.trim() || !price) return
    setBusy(true)
    setErrorMsg(null)
    const supabase = createBrowserSupabaseClient()
    const payload = {
      practitioner_id: practitionerId,
      name: name.trim(),
      duration_minutes: parseInt(duration) || 60,
      price: parseInt(price) || 0,
      description: description.trim() || null,
      category,
    }

    const { error } = editingId
      ? await supabase.from('services').update(payload).eq('id', editingId)
      : await supabase.from('services').insert(payload)

    if (error) {
      setErrorMsg(`儲存失敗：${error.message}`)
    } else {
      await fetchServices()
      resetForm()
    }
    setBusy(false)
  }

  async function deleteService(id: string) {
    if (!window.confirm('確定要刪除這個服務項目嗎？')) return
    setBusy(true)
    setErrorMsg(null)
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase.from('services').delete().eq('id', id)
    if (error) setErrorMsg(`刪除失敗：${error.message}`)
    await fetchServices()
    setBusy(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">載入中...</div>

  return (
    <div className="min-h-screen bg-background">
      <nav className="lg:hidden sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/practitioner/dashboard">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <span className="font-semibold">服務管理</span>
      </nav>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {services.length === 0 && !showForm ? (
          <p className="text-muted-foreground text-sm text-center py-8">尚無服務項目，請新增</p>
        ) : (
          <div className="space-y-2">
            {services.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{s.name}</p>
                      {s.category && (
                        <span className="text-[11px] bg-accent text-accent-foreground px-2 py-0.5 rounded-full">{s.category}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.duration_minutes} 分鐘・NT${s.price}</p>
                    {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => startEdit(s)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => deleteService(s.id)} disabled={busy}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

        {showForm ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{editingId ? '編輯服務項目' : '新增服務項目'}</p>
                <button onClick={resetForm}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div>
                <Label>服務名稱</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例：運動按摩" className="mt-1" />
              </div>
              <div>
                <Label>服務分類</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {SERVICE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.value}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>時長（分鐘）</Label>
                  <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>價格（NT$）</Label>
                  <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>說明（選填）</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="服務內容簡述" className="mt-1" />
              </div>
              <Button className="w-full" size="sm" disabled={busy || !name.trim() || !price} onClick={saveService}>
                {busy ? '儲存中...' : editingId ? '儲存修改' : '新增服務'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Button variant="outline" className="w-full" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1.5" />新增服務項目
          </Button>
        )}
      </div>
    </div>
  )
}
