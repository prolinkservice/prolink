'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

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

  redirect('/my-bookings')
}
