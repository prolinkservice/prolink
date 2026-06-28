import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyCheckMacValue } from '@/lib/ecpay'
import { calcCommission, PLATFORM_COMMISSION_RATE } from '@/lib/commission'
import { notifyPractitioner, notifyUser } from '@/lib/notifications'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  full_online: '線上刷卡（全額）',
  cash: '現場付現結尾款',
  transfer: '轉帳結尾款',
}

const WEEKDAY_LABEL = ['日', '一', '二', '三', '四', '五', '六']

// 綠界 ReturnURL 是伺服器對伺服器的非同步通知，沒有使用者登入狀態，
// 必須用 service role key 才能寫入資料（RLS 只允許本人操作自己的預約）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const params = Object.fromEntries(new URLSearchParams(body))

  if (!verifyCheckMacValue(params)) {
    return new Response('0|CheckMacValue Error', { status: 400 })
  }

  const merchantTradeNo = params.MerchantTradeNo
  const rtnCode = params.RtnCode

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, total_amount, deposit_amount, payment_method, payment_status, practitioner_id, customer_id,
      services ( name ),
      availability_slots ( start_time )
    `)
    .eq('merchant_trade_no', merchantTradeNo)
    .single()

  if (!booking) {
    return new Response('0|Booking Not Found', { status: 404 })
  }

  if (rtnCode === '1' && booking.payment_status === 'unpaid') {
    const paidAmount = Number(params.TradeAmt)
    const newStatus = booking.payment_method === 'full_online' ? 'paid' : 'partially_paid'

    await supabase
      .from('bookings')
      .update({ payment_status: newStatus, trade_no: params.TradeNo ?? null })
      .eq('id', booking.id)

    const commissionAmount = calcCommission(booking.total_amount)
    await supabase.from('transactions').insert({
      booking_id: booking.id,
      amount: paidAmount,
      commission_rate: PLATFORM_COMMISSION_RATE,
      commission_amount: commissionAmount,
      practitioner_payout: booking.total_amount - commissionAmount,
      status: 'completed',
    })

    const service = Array.isArray(booking.services) ? booking.services[0] : booking.services
    const slot = Array.isArray(booking.availability_slots) ? booking.availability_slots[0] : booking.availability_slots
    const timeStr = slot?.start_time
      ? (() => {
          const d = new Date(new Date(slot.start_time).getTime() + 8 * 60 * 60 * 1000)
          const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
          const dd = String(d.getUTCDate()).padStart(2, '0')
          const hh = String(d.getUTCHours()).padStart(2, '0')
          const min = String(d.getUTCMinutes()).padStart(2, '0')
          return `${mm}/${dd}（${WEEKDAY_LABEL[d.getUTCDay()]}）${hh}:${min}`
        })()
      : ''

    const remainingAmount = booking.total_amount - booking.deposit_amount
    const remainingLine = booking.payment_method === 'full_online'
      ? '尾款：已線上付清，現場不需再收費'
      : `尾款：NT$${remainingAmount.toLocaleString()}（${PAYMENT_METHOD_LABEL[booking.payment_method] ?? booking.payment_method}，請與客人現場核對收款）`

    const lineText = [
      '✅ 客人已完成付款',
      '',
      service?.name ? `服務：${service.name}` : null,
      timeStr ? `時間：${timeStr}` : null,
      `已付10%定金（平台服務費）`,
      remainingLine,
      '',
      `查看預約詳情：${SITE_URL}/practitioner/dashboard/bookings?today=1`,
    ].filter(Boolean).join('\n')

    await notifyPractitioner(supabase, booking.practitioner_id, {
      type: 'payment_received',
      title: '客人已完成付款',
      body: service?.name ? `${service.name}的平台服務費已付款完成` : '平台服務費已付款完成',
      link: '/practitioner/dashboard/bookings?today=1',
      lineText,
    })

    if (booking.customer_id) {
      const customerLineText = [
        '⏳ 等待老師確認接單',
        '',
        service?.name ? `服務：${service.name}` : null,
        timeStr ? `時間：${timeStr}` : null,
        '',
        '你的預約申請已送出，目前還在等老師確認，尚未正式成立',
        '老師確認後會再通知你，記得留意LINE訊息',
        `查看預約詳情：${SITE_URL}/my-bookings`,
      ].filter(Boolean).join('\n')

      await notifyUser(supabase, booking.customer_id, {
        type: 'payment_received',
        title: '已送出預約申請',
        body: '已預約該老師此時段，但老師尚未確認接單，非正式確認預約，待老師確認後會再通知您',
        link: '/my-bookings',
        lineText: customerLineText,
      })
    }
  }

  return new Response('1|OK')
}
