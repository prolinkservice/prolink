'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { updateFollowupMessage } from '../actions'

export const DEFAULT_FOLLOWUP_MESSAGE = '{{name}}，謝謝你今天來體驗服務，希望這次的時間讓你感到放鬆～如果有任何感受或建議都歡迎跟我說，期待下次再為你服務！'

const VARIABLES = [
  { key: '{{name}}', label: '客人姓名', hint: '自動帶入客人姓名，沒填寫就用 LINE 顯示名稱' },
  { key: '{{reviewLink}}', label: '評價連結', hint: '客人點擊後可直接前往留評價' },
]

function renderPreview(template: string) {
  return template
    .replace(/\{\{name\}\}/g, '小美')
    .replace(/\{\{reviewLink\}\}/g, 'https://prolink-delta.vercel.app/review/xxxx')
}

export function FollowupMessageForm() {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  function insertVariable(key: string) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart ?? message.length
    const end = el.selectionEnd ?? message.length
    const next = message.slice(0, start) + key + message.slice(end)
    setMessage(next)
    setSaved(false)
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + key.length
    })
  }

  if (loading) return <p className="text-muted-foreground text-sm text-center py-8">載入中...</p>

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          完成後問候訊息
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
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
          className="flex flex-col gap-3"
        >
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              {VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  title={v.hint}
                  onClick={() => insertVariable(v.key)}
                  className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors active:scale-95"
                >
                  + {v.label}
                </button>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              name="followupMessage"
              value={message}
              onChange={(e) => { setMessage(e.target.value); setSaved(false) }}
              maxLength={500}
              className="w-full bg-white border border-border rounded-xl px-3.5 py-3 text-sm leading-relaxed resize-none min-h-[160px] focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-muted-foreground">{message.length}/500</span>
              <div className="flex items-center gap-3">
                {saved && <span className="text-xs text-green-600">已儲存</span>}
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? '儲存中...' : '儲存'}
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-[#F8F7F5] rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">客人收到時的樣子（預覽）</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{renderPreview(message) || '輸入內容後會在這裡預覽'}</p>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
