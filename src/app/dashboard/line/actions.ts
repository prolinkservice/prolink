'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentTenant } from '@/lib/tenant'

export type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * 客人找得到店家的兩個欄位。免費方案沒有任何自動通知，
 * 這條 LINE 連結就是客人唯一的售後管道，比什麼設定都重要。
 */
export async function saveContact(input: {
  lineFriendUrl: string
  contactPhone: string
}): Promise<ActionResult> {
  const current = await getCurrentTenant()
  if (!current) return { ok: false, error: '請先登入' }
  const { tenant } = current

  const url = input.lineFriendUrl.trim()
  if (url) {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return { ok: false, error: '請貼完整的網址，開頭要有 https://' }
    }
    if (parsed.protocol !== 'https:') {
      return { ok: false, error: '連結必須是 https:// 開頭' }
    }
    // 客人會直接點這條連結，只放行 LINE 自己的網域，
    // 免得後台被入侵時變成導流到釣魚站的入口
    const host = parsed.hostname.toLowerCase()
    const allowed =
      host === 'line.me' ||
      host.endsWith('.line.me') ||
      host === 'lin.ee' ||
      host.endsWith('.lin.ee')
    if (!allowed) {
      return { ok: false, error: '請貼 LINE 官方的連結（line.me 或 lin.ee）' }
    }
  }

  const phone = input.contactPhone.trim()

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('tenants')
    .update({ line_friend_url: url || null, contact_phone: phone || null })
    .eq('id', tenant.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/dashboard/line')
  revalidatePath(`/p/${tenant.slug}`)
  return { ok: true }
}
