import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentTenant } from '@/lib/tenant'
import { decryptSecret, hasEncryptionKey, maskTail } from '@/lib/line/secrets'
import { ContactForm } from './ContactForm'
import { ChannelCard, type ChannelState } from './ChannelCard'
import { UsageCard, type UsageRow } from './UsageCard'

export const metadata: Metadata = { title: 'LINE 官方帳號 · 職人連結' }

// 草稿：docs/mockups/line-setup.html
// 接上職人自己的官方帳號（規格 §9.1），並把免費額度用了多少攤開來給他看（§9.2）。

export default async function LinePage() {
  const current = await getCurrentTenant()
  if (!current) return null
  const { tenant } = current

  const supabase = await createServerSupabaseClient()
  const month = new Date().toISOString().slice(0, 7)

  const [channelRes, operatorRes, usageRes] = await Promise.all([
    supabase
      .from('tenant_line_channels')
      .select(
        `channel_id, channel_secret_encrypted, access_token_encrypted,
         bot_basic_id, bot_display_name, operator_bind_code,
         webhook_verified_at, status`
      )
      .eq('tenant_id', tenant.id)
      .maybeSingle(),
    supabase
      .from('tenant_line_operators')
      .select('id')
      .eq('tenant_id', tenant.id)
      .limit(1),
    supabase
      .from('line_message_logs')
      .select('type, sent_at')
      .eq('tenant_id', tenant.id)
      .eq('quota_month', month),
  ])

  const row = channelRes.data
  const state: ChannelState = {
    connected: Boolean(row?.access_token_encrypted),
    channelId: row?.channel_id ?? null,
    // 只顯示末四碼：完整內容存進去之後就不再回到畫面上
    secretTail: safeTail(row?.channel_secret_encrypted),
    tokenTail: safeTail(row?.access_token_encrypted),
    botBasicId: row?.bot_basic_id ?? null,
    botDisplayName: row?.bot_display_name ?? null,
    webhookVerifiedAt: row?.webhook_verified_at ?? null,
    operatorBound: (operatorRes.data ?? []).length > 0,
    bindCode: row?.operator_bind_code ?? null,
    status: row?.status ?? null,
    // 讀不到就要講出來。安靜地顯示「還沒接上」，會讓人以為自己剛才白填了
    loadError: channelRes.error?.message ?? null,
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://prolink.tw').replace(/\/$/, '')

  return (
    <main className="pb-10">
      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-[21px] font-extrabold tracking-tight">LINE 官方帳號</h1>
        <p className="text-[12.5px] text-ink-3">用你自己的名義發通知，客人加的是你的帳號。</p>
      </div>

      <ChannelCard
        state={state}
        webhookUrl={`${siteUrl}/api/line/webhook/${tenant.id}`}
        hasKey={hasEncryptionKey()}
      />

      <UsageCard
        month={month}
        rows={(usageRes.data ?? []) as UsageRow[]}
        connected={state.connected}
      />

      <ContactForm
        lineFriendUrl={tenant.line_friend_url ?? ''}
        contactPhone={tenant.contact_phone ?? ''}
        plan={tenant.plan}
      />
    </main>
  )
}

/** 換過金鑰的舊憑證解不開，這時候顯示「要重貼」而不是讓整頁掛掉 */
function safeTail(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null
  try {
    return maskTail(decryptSecret(encrypted))
  } catch {
    return '解不開，請重貼'
  }
}
