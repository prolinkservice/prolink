'use server'

import { redirect } from 'next/navigation'
import { cancelUnpaidBooking } from '@/app/my-bookings/actions'

export async function cancelUnpaidBookingAndRedirect(formData: FormData) {
  const bookingId = formData.get('bookingId') as string
  await cancelUnpaidBooking(bookingId)
  redirect('/')
}
