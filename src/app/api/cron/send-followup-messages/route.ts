import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { notifyUser } from '@/lib/notifications'
import { getLineDisplayName } from '@/lib/lineMessaging'

const FOLLOWUP_DELAY_HOURS = 24
const DEFAULT_FOLLOWUP_MESSAGE = '{{name}}，謝謝你今天來體驗服務，希望這次的時間讓你感到放鬆～如果有任何感受或建議都歡迎跟我說，期待下次再為你服務！'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

function fillTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match)
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()
  const cutoff = new Date(Date.now() - FOLLOWUP_DELAY_HOURS * 60 * 60 * 1000).toISOString()

  const { data: bookings } = await admin
    .from('bookings')
    .select('id, customer_id, practitioners ( followup_message ), profiles ( display_name, line_user_id )')
    .eq('status', 'completed')
    .is('followup_sent_at', null)
    .lt('completed_at', cutoff)

  const sent: string[] = []

  for (const booking of bookings ?? []) {
    const practitioner = Array.isArray(booking.practitioners) ? booking.practitioners[0] : booking.practitioners
    const customerProfile = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles
    const template = practitioner?.followup_message || DEFAULT_FOLLOWUP_MESSAGE

    // 客人姓名：先用站內填寫的姓名，沒填就抓 LINE 顯示名稱，都沒有就用「你」
    const lineDisplayName = customerProfile?.line_user_id ? await getLineDisplayName(customerProfile.line_user_id) : null
    const name = customerProfile?.display_name || lineDisplayName || '你'
    const reviewLink = `${SITE_URL}/review/${booking.id}`

    const message = fillTemplate(template, { name, reviewLink })

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
