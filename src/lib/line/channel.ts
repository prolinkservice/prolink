import { createHmac, timingSafeEqual } from 'node:crypto'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { decryptSecret } from './secrets'

// 每個租戶自己的 LINE 官方帳號（規格 §9.1 BYO Channel）。
//
// 舊版是全站一組憑證放在環境變數裡；現在每家店一組，所以讀取一律
// 經過這裡。Webhook 沒有登入身分，只能用 service role 讀，
// 因此這個檔案永遠只在伺服器端執行。

export type LineChannel = {
  tenantId: string
  channelId: string | null
  channelSecret: string
  accessToken: string
  botBasicId: string | null
  botDisplayName: string | null
  operatorBindCode: string | null
  status: string
}

export type BotInfo = { basicId: string; displayName: string; userId: string }

const API = 'https://api.line.me/v2/bot'

/**
 * 讀出某個租戶的憑證並解密。
 * 找不到、沒設定、或金鑰換過解不開，一律回 null——
 * 呼叫端要能安靜地略過，不能因為一家店沒接 LINE 就整批發送掛掉。
 */
export async function loadChannel(tenantId: string): Promise<LineChannel | null> {
  const supabase = createAdminSupabaseClient()
  const { data } = await supabase
    .from('tenant_line_channels')
    .select(
      `tenant_id, channel_id, channel_secret_encrypted, access_token_encrypted,
       bot_basic_id, bot_display_name, operator_bind_code, status`
    )
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!data?.channel_secret_encrypted || !data?.access_token_encrypted) return null

  try {
    return {
      tenantId: data.tenant_id,
      channelId: data.channel_id,
      channelSecret: decryptSecret(data.channel_secret_encrypted),
      accessToken: decryptSecret(data.access_token_encrypted),
      botBasicId: data.bot_basic_id,
      botDisplayName: data.bot_display_name,
      operatorBindCode: data.operator_bind_code,
      status: data.status,
    }
  } catch (error) {
    console.error('[line] 憑證解不開', {
      tenantId,
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * 拿 access token 去問 LINE「這是誰的帳號」。
 * 這是唯一能確認職人貼對憑證的方法——貼錯的 token 在這一步就會被擋下，
 * 而不是等到要發通知給客人時才發現。
 */
export async function fetchBotInfo(
  accessToken: string
): Promise<{ ok: true; info: BotInfo } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API}/info`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })

    if (res.status === 401) return { ok: false, error: 'Access token 不正確或已失效' }
    if (!res.ok) {
      return { ok: false, error: `LINE 回應 ${res.status}，請稍後再試` }
    }

    const body = (await res.json()) as {
      basicId?: string
      displayName?: string
      userId?: string
    }
    return {
      ok: true,
      info: {
        basicId: body.basicId ?? '',
        displayName: body.displayName ?? '',
        userId: body.userId ?? '',
      },
    }
  } catch (error) {
    console.error('[line] 問不到帳號資訊', error)
    return { ok: false, error: '連不上 LINE，請稍後再試' }
  }
}

/**
 * Webhook 的簽章驗證。沒有這一步，任何人都能對著我們的網址
 * 偽造「客人傳了訊息」的事件。
 */
export function verifySignature(
  rawBody: string,
  signature: string | null,
  channelSecret: string
): boolean {
  if (!signature) return false
  const expected = createHmac('sha256', channelSecret).update(rawBody).digest('base64')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export type LineMessage =
  | { type: 'text'; text: string }
  | { type: 'flex'; altText: string; contents: unknown }

/**
 * 回覆訊息。**不計入免費額度**，所以能用回覆的就不要用推播——
 * 歡迎訊息、客人按按鈕之後的答覆都走這條，一個月省下的量很可觀。
 * 回覆權杖只在事件發生後短時間內有效，過期就發不出去，這是刻意的。
 */
export async function replyMessage(
  accessToken: string,
  replyToken: string | undefined,
  messages: LineMessage[]
): Promise<void> {
  if (!replyToken || messages.length === 0) return
  try {
    const res = await fetch(`${API}/message/reply`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ replyToken, messages }),
    })
    if (!res.ok) {
      console.error('[line] 回覆失敗', { status: res.status, detail: await res.text() })
    }
  } catch (error) {
    console.error('[line] 回覆時連不上 LINE', error)
  }
}

/**
 * 用職人的名義發訊息，並記一筆用量。
 *
 * 記用量是為了後台的看板：LINE 免費方案每月 200 則，系統自動發確認與
 * 提醒很容易爆量，而職人是收到 LINE 帳單才發現（規格 §9.2）。
 */
export async function pushMessage(input: {
  tenantId: string
  to: string
  messages: LineMessage[]
  /** 用量看板要拆給職人看錢花在哪 */
  type: string
  customerId?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const channel = await loadChannel(input.tenantId)
  if (!channel) return { ok: false, error: '這家店還沒接上 LINE 官方帳號' }

  try {
    const res = await fetch(`${API}/message/push`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${channel.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: input.to, messages: input.messages }),
    })

    if (!res.ok) {
      const detail = await res.text()
      console.error('[line] 發送失敗', { tenantId: input.tenantId, status: res.status, detail })
      if (res.status === 400 && detail.includes('not found')) {
        return { ok: false, error: '找不到這位使用者，他可能還沒加好友或已封鎖' }
      }
      return { ok: false, error: `LINE 回應 ${res.status}` }
    }
  } catch (error) {
    console.error('[line] 發送時連不上 LINE', error)
    return { ok: false, error: '連不上 LINE，請稍後再試' }
  }

  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('line_message_logs').insert({
    tenant_id: input.tenantId,
    customer_id: input.customerId ?? null,
    source_type: 'user',
    source_id: input.to,
    type: input.type,
    quota_month: new Date().toISOString().slice(0, 7),
  })
  // 訊息已經發出去了，記帳失敗只影響看板，不該讓呼叫端以為沒發成功
  if (error) console.error('[line] 用量沒記到', { tenantId: input.tenantId, message: error.message })

  return { ok: true }
}
