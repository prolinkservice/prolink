import { createServerSupabaseClient } from '@/lib/supabase-server'

type NotificationType = 'new_booking' | 'new_review' | 'verification_result'

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

  await supabase.from('notifications').insert({
    user_id: practitioner.user_id,
    type: notification.type,
    title: notification.title,
    body: notification.body ?? null,
    link: notification.link ?? null,
  })
}
