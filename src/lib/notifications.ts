import type { SupabaseClient } from '@supabase/supabase-js'
import { pushLineMessage } from '@/lib/lineMessaging'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

type NotificationType =
  | 'new_booking'
  | 'new_review'
  | 'verification_result'
  | 'booking_confirmed'
  | 'payment_received'
  | 'cancellation_requested'
  | 'cancellation_approved'
  | 'cancellation_rejected'
  | 'followup_message'

export async function notifyUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  notification: { type: NotificationType; title: string; body?: string; link?: string; lineText?: string; skipLine?: boolean }
) {
  await supabase.from('notifications').insert({
    user_id: userId,
    type: notification.type,
    title: notification.title,
    body: notification.body ?? null,
    link: notification.link ?? null,
  })

  if (notification.skipLine) return

  // 查詢對方是否綁定 LINE 一律用 service role，避免呼叫者（例如老師查客人）受限於 profiles 表的 RLS 而靜默查不到資料
  const { data: profile } = await createAdminSupabaseClient()
    .from('profiles')
    .select('line_user_id')
    .eq('id', userId)
    .single()

  if (profile?.line_user_id) {
    const text = notification.lineText ?? (notification.body
      ? `${notification.title}\n${notification.body}`
      : notification.title)
    await pushLineMessage(profile.line_user_id, text)
  }
}

export async function notifyPractitioner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  practitionerId: string,
  notification: { type: NotificationType; title: string; body?: string; link?: string; lineText?: string; skipLine?: boolean }
) {
  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('user_id')
    .eq('id', practitionerId)
    .single()

  if (!practitioner?.user_id) return

  await notifyUser(supabase, practitioner.user_id, notification)
}
