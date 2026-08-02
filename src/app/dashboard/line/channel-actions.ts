'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentTenant } from '@/lib/tenant'
import { fetchBotInfo, pushMessage } from '@/lib/line/channel'
import { encryptSecret, hasEncryptionKey, newBindCode } from '@/lib/line/secrets'

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

/**
 * 貼上憑證 → 先問 LINE 這是誰的帳號 → 通過才加密存起來。
 * 不先驗證的話，貼錯的 token 要等到真的要通知客人時才爆——
 * 那時候客人已經在等訊息了。
 */
export async function saveChannel(input: {
  channelId: string
  channelSecret: string
  accessToken: string
}): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }
  if (current.member.role !== 'owner') {
    return { ok: false, error: '只有擁有者可以設定 LINE 官方帳號' }
  }
  if (!hasEncryptionKey()) {
    return { ok: false, error: '伺服器還沒設定 LINE_CREDENTIALS_KEY，沒有金鑰不能存憑證' }
  }

  const channelId = input.channelId.trim()
  const channelSecret = input.channelSecret.trim()
  const accessToken = input.accessToken.trim()
  if (!channelSecret || !accessToken) {
    return { ok: false, error: '請填 Channel secret 與 Access token' }
  }

  const info = await fetchBotInfo(accessToken)
  if (!info.ok) return { ok: false, error: info.error }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('tenant_line_channels').upsert(
    {
      tenant_id: current.tenant.id,
      channel_id: channelId || null,
      channel_secret_encrypted: encryptSecret(channelSecret),
      access_token_encrypted: encryptSecret(accessToken),
      bot_basic_id: info.info.basicId,
      bot_display_name: info.info.displayName,
      operator_bind_code: newBindCode(),
      status: 'active',
      last_checked_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id' }
  )

  if (error) return { ok: false, error: error.message }

  revalidatePath('/dashboard/line')
  return { ok: true, message: `已連上 ${info.info.displayName || info.info.basicId}` }
}

/** 重新問一次 LINE，確認 token 還有效（他可能在 LINE 後台重發過） */
export async function recheckChannel(): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }

  const { loadChannel } = await import('@/lib/line/channel')
  const channel = await loadChannel(current.tenant.id)
  if (!channel) return { ok: false, error: '還沒接上 LINE 官方帳號' }

  const info = await fetchBotInfo(channel.accessToken)
  const supabase = await createServerSupabaseClient()

  await supabase
    .from('tenant_line_channels')
    .update({
      status: info.ok ? 'active' : 'error',
      last_checked_at: new Date().toISOString(),
      ...(info.ok
        ? { bot_basic_id: info.info.basicId, bot_display_name: info.info.displayName }
        : {}),
    })
    .eq('tenant_id', current.tenant.id)

  revalidatePath('/dashboard/line')
  return info.ok
    ? { ok: true, message: `連線正常：${info.info.displayName || info.info.basicId}` }
    : { ok: false, error: info.error }
}

/** 中斷連線就把憑證整組刪掉，不留半份在資料庫裡 */
export async function disconnectChannel(): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }
  if (current.member.role !== 'owner') {
    return { ok: false, error: '只有擁有者可以中斷連線' }
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('tenant_line_channels')
    .delete()
    .eq('tenant_id', current.tenant.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/dashboard/line')
  return { ok: true, message: '已中斷連線，憑證已從資料庫刪除' }
}

/** 換一組綁定碼。上一組如果被截圖傳出去了，換掉就作廢 */
export async function regenerateBindCode(): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('tenant_line_channels')
    .update({ operator_bind_code: newBindCode() })
    .eq('tenant_id', current.tenant.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/dashboard/line')
  return { ok: true, message: '已產生新的綁定碼' }
}

/**
 * 發一則測試訊息給職人自己。
 * 收得到才代表真的通了——憑證對、webhook 對、他也加了自己的好友。
 */
export async function sendTestMessage(): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }

  const supabase = await createServerSupabaseClient()
  const { data: operator } = await supabase
    .from('tenant_line_operators')
    .select('line_user_id')
    .eq('tenant_id', current.tenant.id)
    .order('bound_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!operator) {
    return {
      ok: false,
      error: '還不知道你的 LINE 是哪一個。先用你自己的 LINE 把下面那組綁定碼傳給官方帳號。',
    }
  }

  const res = await pushMessage({
    tenantId: current.tenant.id,
    to: operator.line_user_id,
    type: 'test',
    messages: [
      {
        type: 'text',
        text: `${current.tenant.name} 的 LINE 已經接上了。\n之後客人的預約確認與行前提醒都會從這個帳號發出去。`,
      },
    ],
  })

  if (!res.ok) return { ok: false, error: res.error }

  revalidatePath('/dashboard/line')
  return { ok: true, message: '已發送，去 LINE 看看收到了沒' }
}
