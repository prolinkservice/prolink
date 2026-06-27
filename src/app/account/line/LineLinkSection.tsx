'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createBrowserSupabaseClient } from '@/lib/supabase'

export function LineLinkSection({ next = '/account/line' }: { next?: string }) {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [linked, setLinked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('line_user_id')
        .eq('id', user.id)
        .single()
      setLinked(!!profile?.line_user_id)
      setLoading(false)
    }
    load()
  }, [router])

  async function handleUnlink() {
    if (!userId) return
    setSaving(true)
    const supabase = createBrowserSupabaseClient()
    await supabase.from('profiles').update({ line_user_id: null }).eq('id', userId)
    setLinked(false)
    setSaving(false)
  }

  if (loading) return <p className="text-sm text-muted-foreground">載入中...</p>

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-foreground mb-1">LINE 通知綁定</h3>
        <p className="text-sm text-muted-foreground">
          綁定 LINE 帳號後，預約相關通知（新預約、老師確認接單等）除了站內通知，也會同步透過 LINE 訊息推播給你。
          綁定前請先加 LINE 官方帳號好友，否則無法收到推播訊息。
        </p>
      </div>

      {linked ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
          <span className="text-sm font-medium text-foreground">已綁定 LINE</span>
          <Button variant="outline" size="sm" disabled={saving} onClick={handleUnlink}>
            {saving ? '解除中...' : '解除綁定'}
          </Button>
        </div>
      ) : (
        <a href={`/auth/line/start?next=${encodeURIComponent(next)}`}>
          <Button className="w-full bg-[#06C755] hover:bg-[#05b34c] text-white">
            綁定 LINE 帳號
          </Button>
        </a>
      )}
    </div>
  )
}
