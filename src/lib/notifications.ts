import { createServerSupabaseClient } from '@/lib/supabase-server'
import { pushLineMessage } from '@/lib/lineMessaging'

type NotificationType = 'new_booking' | 'new_review' | 'verification_result' | 'booking_confirmed'

export async function notifyUser(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  notification: { type: NotificationType; title: string; body?: string; link?: string }
) {
  await supabase.from('notifications').insert({
    user_id: userId,
    type: notification.type,
    title: notification.title,
    body: notification.body ?? null,
    link: notification.link ?? null,
  })

  const { data: profile } = await supabase
    .from('profiles')
    .select('line_user_id')
    .eq('id', userId)
    .single()

  if (profile?.line_user_id) {
    const text = notification.body
      ? `${notification.title}\n${notification.body}`
      : notification.title
    await pushLineMessage(profile.line_user_id, text)
  }
}

export async function notifyPractitioner(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  practitionerId: string,
  notification: { type: NotificationType; title: string; body?: string; link?: string }
) {
  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('user_id')
    .eq('id', practitionerId)
    .single()

  if (!practitioner?.user_id) return

  await notifyUser(supabase, practitioner.user_id, notification)
}
