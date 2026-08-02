import { NextResponse, type NextRequest } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { loadChannel, verifySignature } from '@/lib/line/channel'
import { codeMatches } from '@/lib/line/secrets'

// 每個租戶自己的 webhook（規格 §9.1）。
// 網址帶 tenantId，簽章用「那一家店的」channel secret 驗——
// 全站一組 secret 的話，A 店的憑證就能偽造 B 店的事件。
//
// LINE 要求快速回 200，否則會重送並在後台標記失敗。
// 所以這裡只做必要的事，不做慢的工作。

type LineEvent = {
  type: string
  replyToken?: string
  source?: { type: string; userId?: string; groupId?: string }
  message?: { type: string; text?: string }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params
  const rawBody = await request.text()

  const channel = await loadChannel(tenantId)
  // 還沒接上的店：安靜地回 200。LINE 那邊看到 4xx 會一直重送
  if (!channel) return NextResponse.json({ ok: true })

  if (!verifySignature(rawBody, request.headers.get('x-line-signature'), channel.channelSecret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()

  // 收到第一個通過驗證的事件，就代表職人把 webhook 貼對了。
  // 後台靠這個時間戳顯示「已驗證」，不用他自己回來按檢查
  await supabase
    .from('tenant_line_channels')
    .update({ webhook_verified_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)

  let events: LineEvent[] = []
  try {
    events = (JSON.parse(rawBody) as { events?: LineEvent[] }).events ?? []
  } catch {
    return NextResponse.json({ ok: true })
  }

  for (const event of events) {
    const userId = event.source?.userId
    if (!userId) continue

    // 群組訊息留給 Sprint 8，但來源類型現在就分開記（規格 §9.6 預留項目 1）
    if (event.source?.type !== 'user') continue

    if (event.type === 'message' && event.message?.type === 'text') {
      await handleText({
        tenantId,
        userId,
        text: event.message.text ?? '',
        bindCode: channel.operatorBindCode,
        replyToken: event.replyToken,
        accessToken: channel.accessToken,
      })
    }
  }

  return NextResponse.json({ ok: true })
}

/**
 * 目前只認綁定碼。職人用自己的 LINE 把碼傳給官方帳號，
 * 我們才知道「他本人的 LINE 是哪一個」——之後測試訊息、
 * 一句話建立預約都要用到。
 *
 * 不用「第一個傳訊息的人就是老闆」，那等於誰先傳誰是老闆。
 */
async function handleText(input: {
  tenantId: string
  userId: string
  text: string
  bindCode: string | null
  replyToken?: string
  accessToken: string
}) {
  if (!codeMatches(input.text, input.bindCode)) return

  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('tenant_line_operators').upsert(
    {
      tenant_id: input.tenantId,
      line_user_id: input.userId,
      role: 'admin',
    },
    { onConflict: 'tenant_id,line_user_id' }
  )

  if (error) {
    console.error('[line] 綁定操作者失敗', { tenantId: input.tenantId, message: error.message })
    return
  }

  // 綁定碼用過就作廢，避免被截圖或轉傳之後有人拿去綁自己
  await supabase
    .from('tenant_line_channels')
    .update({ operator_bind_code: null })
    .eq('tenant_id', input.tenantId)

  await reply(input.accessToken, input.replyToken, '綁定完成，之後的通知會從這個帳號發給客人。')
}

async function reply(accessToken: string, replyToken: string | undefined, text: string) {
  if (!replyToken) return
  try {
    // 回覆訊息不計入免費額度，所以不寫進用量紀錄
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    })
  } catch (error) {
    console.error('[line] 回覆失敗', error)
  }
}
