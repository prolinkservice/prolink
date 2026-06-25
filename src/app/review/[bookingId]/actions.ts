'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notifyPractitioner } from '@/lib/notifications'

export async function submitReview(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const bookingId = formData.get('bookingId') as string
  const practitionerId = formData.get('practitionerId') as string
  const rating = Number(formData.get('rating'))
  const comment = formData.get('comment') as string | null

  await supabase.from('reviews').insert({
    booking_id: bookingId,
    practitioner_id: practitionerId,
    customer_id: user.id,
    rating,
    comment: comment || null,
  })

  await notifyPractitioner(supabase, practitionerId, {
    type: 'new_review',
    title: '收到新評價',
    body: `學員給了你 ${rating} 顆星評價`,
    link: '/practitioner/dashboard/reviews',
  })

  redirect('/my-bookings')
}
