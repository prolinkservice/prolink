import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { notifyUser } from '@/lib/notifications'

const FOLLOWUP_DELAY_HOURS = 24
const DEFAULT_FOLLOWUP_MESSAGE = '謝謝你今天來體驗服務，希望這次的時間讓你感到放鬆～如果有任何感受或建議都歡迎跟我說，期待下次再為你服務！'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()
  const cutoff = new Date(Date.now() - FOLLOWUP_DELAY_HOURS * 60 * 60 * 1000).toISOString()

  const { data: bookings } = await admin
    .from('bookings')
    .select('id, customer_id, practitioners ( followup_message )')
    .eq('status', 'completed')
    .is('followup_sent_at', null)
    .lt('completed_at', cutoff)

  const sent: string[] = []

  for (const booking of bookings ?? []) {
    const practitioner = Array.isArray(booking.practitioners) ? booking.practitioners[0] : booking.practitioners
    const message = practitioner?.followup_message || DEFAULT_FOLLOWUP_MESSAGE

    await notifyUser(admin, booking.customer_id, {
      type: 'followup_message',
      title: '老師想對你說',
      body: message,
      link: '/my-bookings',
      lineText: `💌 ${message}`,
    })

    await admin.from('bookings').update({ followup_sent_at: new Date().toISOString() }).eq('id', booking.id)
    sent.push(booking.id)
  }

  return NextResponse.json({ ok: true, sent: sent.length, bookingIds: sent })
}
