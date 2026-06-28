'use client'

import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { updateFollowupMessage } from '../actions'

export const DEFAULT_FOLLOWUP_MESSAGE = '謝謝你今天來體驗服務，希望這次的時間讓你感到放鬆～如果有任何感受或建議都歡迎跟我說，期待下次再為你服務！'

export function FollowupMessageForm() {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: practitioner } = await supabase
        .from('practitioners')
        .select('followup_message')
        .eq('user_id', user.id)
        .single()
      setMessage(practitioner?.followup_message ?? DEFAULT_FOLLOWUP_MESSAGE)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <p className="text-muted-foreground text-sm text-center py-8">載入中...</p>

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          完成後問候訊息
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          客人的預約被你標記「完成」24小時後，會自動透過 LINE 發送這則訊息給客人，內容可以自行修改。
        </p>
        <form
          action={async (formData) => {
            setSaving(true)
            setSaved(false)
            await updateFollowupMessage(formData)
            setSaving(false)
            setSaved(true)
          }}
          className="flex flex-col gap-2"
        >
          <textarea
            name="followupMessage"
            value={message}
            onChange={(e) => { setMessage(e.target.value); setSaved(false) }}
            maxLength={300}
            className="w-full bg-white border border-border rounded-xl px-3 py-2 text-sm resize-none min-h-[100px] focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{message.length}/300</span>
            <div className="flex items-center gap-2">
              {saved && <span className="text-xs text-green-600">已儲存</span>}
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? '儲存中...' : '儲存'}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
