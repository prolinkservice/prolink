'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { BookingRow } from '@/lib/bookings'
import { formatDateTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { ErrorNote, Field, TextBox } from '@/components/FormBits'
import { cancelBooking } from './actions'

// 取消一筆還沒發生的預約。草稿：docs/mockups/line-notifications.html §5
//
// 跟結帳那張表單刻意長得不一樣：這裡沒有金額、沒有付款方式，
// 只有兩件事——原因（留給自己看）與要不要通知客人。
//
// 原因不會出現在發給客人的訊息裡。職人填的常常是內部備註，
// 直接送到客人眼前會出事（2026-08-02 定案）。

export function CancelSheet({
  booking,
  timezone,
  refundableHours,
  onClose,
}: {
  booking: BookingRow
  timezone: string
  /** 這個數字同時是退定金與計點的門檻，職人只需要理解一個（規格 §6.1） */
  refundableHours: number
  onClose: () => void
}) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [notify, setNotify] = useState(booking.customer_line_linked)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const hoursLeft = Math.max(
    0,
    Math.round((new Date(booking.start_at).getTime() - Date.now()) / 3_600_000)
  )
  const soon = hoursLeft < refundableHours

  function run() {
    setError(null)
    startTransition(async () => {
      const res = await cancelBooking({
        bookingId: booking.id,
        reason,
        notifyCustomer: notify && booking.customer_line_linked,
      })
      if (!res.ok) return setError(res.error)
      onClose()
      router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-xl bg-card shadow-float sm:rounded-xl">
        <header className="sticky top-0 z-10 flex items-center gap-3 bg-card px-5 pt-5 pb-2">
          <h2 className="text-[16px] font-extrabold tracking-tight">取消預約</h2>
          <span className="num text-[11.5px] font-bold text-ink-3">
            {formatDateTime(booking.start_at, timezone)}
          </span>
          <button
            onClick={onClose}
            aria-label="關閉"
            className="ml-auto grid size-8 place-items-center rounded-full bg-sunk text-[15px] font-extrabold text-ink-3"
          >
            ✕
          </button>
        </header>

        <div className="px-5 pb-5">
          <div className="rounded-sm bg-sunk px-4 py-3.5">
            <b className="block text-[14px] font-extrabold">
              {booking.customer_name ?? '未指定客人'}
              {booking.service_name && ` · ${booking.service_name}`}
            </b>
            <p className="num mt-0.5 text-[11.5px] text-ink-3">
              {[booking.location_name ?? booking.service_address, booking.customer_phone]
                .filter(Boolean)
                .join('　·　')}
            </p>
          </div>

          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-2">
            取消之後這個時段會馬上放回去，其他客人就約得到了。
          </p>

          <div className="mt-3.5">
            <Field
              label="取消原因"
              optional
              hint="只有你看得到。發給客人的一律是制式的道歉文案"
            >
              <TextBox
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="例：臨時有事，已電話跟客人說過"
              />
            </Field>
          </div>

          {/* 通知這一題只在通知得到的時候才問。沒綁 LINE 的客人問了也是白問，
              而且會讓職人以為系統會幫他講 */}
          {booking.customer_line_linked ? (
            <button
              type="button"
              onClick={() => setNotify((v) => !v)}
              className="flex w-full items-start gap-2.5 rounded-sm bg-sunk px-4 py-3 text-left"
            >
              <span
                className={cn(
                  'mt-px grid size-[19px] shrink-0 place-items-center rounded-[6px] text-[12px] font-extrabold',
                  notify ? 'bg-primary text-primary-foreground' : 'bg-card text-transparent'
                )}
              >
                ✓
              </span>
              <span className="text-[13px] font-bold text-ink-2">
                用 LINE 通知{booking.customer_name ?? '客人'}
                <small className="mt-0.5 block text-[11.5px] font-semibold text-ink-3">
                  他有綁 LINE，會馬上收到取消卡片。
                </small>
              </span>
            </button>
          ) : (
            <p className="rounded-sm bg-sunk px-4 py-3 text-[12px] leading-relaxed font-semibold text-ink-3">
              這位客人沒有綁 LINE，系統通知不到他。取消之後記得自己打通電話說一聲。
            </p>
          )}

          {soon && (
            <p className="mt-3 rounded-sm bg-warn-bg px-4 py-3 text-[12px] leading-relaxed font-bold text-warn">
              距離開始只剩 {hoursLeft} 小時。
              這筆如果有收定金，依民法 §249② 職人取消應加倍返還——定金功能還沒做，
              目前要自己跟客人處理。
            </p>
          )}

          <ErrorNote>{error}</ErrorNote>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              onClick={onClose}
              disabled={pending}
              className="min-h-11 rounded-full bg-sunk px-5 text-[12.5px] font-extrabold text-ink-2"
            >
              先不要
            </button>
            <button
              onClick={run}
              disabled={pending}
              className="min-h-11 rounded-full bg-danger-bg px-5 text-[12.5px] font-extrabold text-danger disabled:opacity-50"
            >
              {pending ? '處理中…' : '取消這筆預約'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
