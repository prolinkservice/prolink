import type { SupabaseClient } from '@supabase/supabase-js'
import { pushLineMessage } from '@/lib/lineMessaging'

type NotificationType = 'new_booking' | 'new_review' | 'verification_result' | 'booking_confirmed' | 'payment_received'

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

  const { data: profile } = await supabase
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
