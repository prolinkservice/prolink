import { NextResponse, type NextRequest } from 'next/server'
import crypto from 'crypto'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

type LineEvent = {
  type: string
  replyToken?: string
  source?: { userId?: string }
}

function verifySignature(body: string, signature: string | null) {
  const secret = process.env.LINE_MESSAGING_CHANNEL_SECRET
  if (!secret || !signature) return false
  const hash = crypto.createHmac('sha256', secret).update(body).digest('base64')
  return hash === signature
}

async function replyMessage(replyToken: string, text: string) {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
  if (!token) return
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-line-signature')

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const { events } = JSON.parse(rawBody) as { events: LineEvent[] }
  const admin = createAdminSupabaseClient()

  for (const event of events) {
    const lineUserId = event.source?.userId
    if (!lineUserId) continue

    if (event.type === 'follow' && event.replyToken) {
      await replyMessage(event.replyToken, '歡迎加入職人連結 ProLink！加入好友後，記得到網站「會員中心」綁定 LINE，就能收到預約相關通知喔。')
    }

    if (event.type === 'unfollow') {
      await admin.from('profiles').update({ line_user_id: null }).eq('line_user_id', lineUserId)
    }
  }

  return NextResponse.json({ ok: true })
}
