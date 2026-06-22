'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { updateBrandInfo } from '../actions'

interface BrandData {
  years_experience: number | null
  certificate_name: string | null
  specialty_tags: string[] | null
  cover_image_url: string | null
}

export function BrandForm() {
  const [data, setData] = useState<BrandData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: practitioner } = await supabase
        .from('practitioners')
        .select('years_experience, certificate_name, specialty_tags, cover_image_url')
        .eq('user_id', user.id)
        .single()
      setData(practitioner as BrandData)
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !data) {
    return <p className="text-muted-foreground text-sm text-center py-8">載入中...</p>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          個人品牌
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={updateBrandInfo} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <Label>執業年資</Label>
              <Input type="number" name="yearsExperience" defaultValue={data.years_experience ?? ''} placeholder="例：5" className="mt-1" min={0} />
            </div>
            <div>
              <Label>證照名稱</Label>
              <Input name="certificateName" defaultValue={data.certificate_name ?? ''} placeholder="例：中醫推拿執照" className="mt-1" />
            </div>
          </div>
          <div>
            <Label>專長標籤（用逗號分隔）</Label>
            <Input name="specialtyTags" defaultValue={(data.specialty_tags ?? []).join(', ')} placeholder="例：運動按摩, 深層組織按摩, 久坐族群調理" className="mt-1" />
          </div>
          <div>
            <Label>封面照網址</Label>
            <Input name="coverImageUrl" defaultValue={data.cover_image_url ?? ''} placeholder="https://..." className="mt-1" />
            <p className="text-xs text-muted-foreground mt-1">建議使用寬幅橫向照片，Demo 階段請貼上圖片連結</p>
          </div>
          <Button type="submit" size="sm" className="self-start active:scale-95 transition-transform">
            儲存
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
