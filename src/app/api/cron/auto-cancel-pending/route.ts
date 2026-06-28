import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { calcRefundAmount, executeApprovedCancellation } from '@/lib/cancellation'

const PENDING_TIMEOUT_HOURS = 2

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabaseClient()
  const cutoff = new Date(Date.now() - PENDING_TIMEOUT_HOURS * 60 * 60 * 1000).toISOString()

  const { data: overdueBookings } = await admin
    .from('bookings')
    .select('id, payment_status, total_amount, deposit_amount, availability_slots ( start_time )')
    .eq('status', 'pending')
    .lt('created_at', cutoff)

  const cancelled: { bookingId: string; refundAmount: number }[] = []
  const needsManualReview: { bookingId: string; error: string }[] = []

  for (const booking of overdueBookings ?? []) {
    const slot = Array.isArray(booking.availability_slots) ? booking.availability_slots[0] : booking.availability_slots
    if (!slot) continue

    const refundAmount = calcRefundAmount(booking, 'system', slot.start_time)

    try {
      await executeApprovedCancellation({ bookingId: booking.id, refundAmount, requestedBy: 'system' })
      await admin.from('cancellation_requests').insert({
        booking_id: booking.id,
        requested_by: 'system',
        reason: '老師超過2小時未確認接單，系統自動取消',
        status: 'approved',
        refund_amount: refundAmount,
        reviewed_at: new Date().toISOString(),
      })
      cancelled.push({ bookingId: booking.id, refundAmount })
    } catch (err) {
      // 退款無法自動完成時，不取消預約，留給人工在「取消審核」後台處理，避免「已取消但錢沒退」的狀態
      const message = err instanceof Error ? err.message : String(err)
      console.error('[cron/auto-cancel-pending]', message)
      await admin.from('cancellation_requests').insert({
        booking_id: booking.id,
        requested_by: 'system',
        reason: '老師超過2小時未確認接單，系統自動取消失敗，需人工處理退款',
        status: 'pending_review',
        admin_note: message,
      })
      needsManualReview.push({ bookingId: booking.id, error: message })
    }
  }

  return NextResponse.json({ ok: true, cancelled: cancelled.length, results: cancelled, needsManualReview })
}
