import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { submitReview } from './actions'
import StarRating from './StarRating'

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, status, customer_id, practitioner_id,
      practitioners ( profiles ( display_name ) )
    `)
    .eq('id', bookingId)
    .eq('customer_id', user.id)
    .single()

  if (!booking || booking.status !== 'completed') notFound()

  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (existing) redirect('/my-bookings')

  const practRaw = Array.isArray(booking.practitioners) ? booking.practitioners[0] : booking.practitioners
  const profRaw = (practRaw as { profiles: unknown } | null)?.profiles
  const prof = (Array.isArray(profRaw) ? profRaw[0] : profRaw) as { display_name: string | null } | null
  const practitionerName = prof?.display_name ?? '老師'

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/my-bookings">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold text-lg">給評價</span>
      </div>

      <form action={submitReview} className="px-4 py-6 max-w-lg mx-auto flex flex-col gap-6">
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="practitionerId" value={booking.practitioner_id} />

        <div className="text-center">
          <p className="text-muted-foreground text-sm mb-1">這次與</p>
          <p className="text-xl font-bold">{practitionerName}</p>
          <p className="text-muted-foreground text-sm mt-1">的服務體驗如何？</p>
        </div>

        <StarRating />

        <textarea
          name="comment"
          placeholder="想跟其他人分享這次的服務體驗嗎？（選填）"
          rows={4}
          className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />

        <Button type="submit" size="lg" className="w-full active:scale-95 transition-transform">
          送出評價
        </Button>
      </form>
    </div>
  )
}
