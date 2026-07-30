'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  PAYMENT_METHODS,
  money,
  type BookingRow,
  type PaymentMethod,
} from '@/lib/bookings'
import { formatTime } from '@/lib/datetime'
import { cn } from '@/lib/utils'
import { ErrorNote, Field, NumberBox, PrimaryButton, TextBox } from '@/components/FormBits'
import { closeBooking } from './actions'

// 結帳登記。草稿：docs/mockups/dashboard.html §04
//
// 現場付款沒有線上金流，營收、客單價、VIP 分群全部靠這一步登記的數字，
// 所以金額一律可改（加購、折扣、湊整數都是常態），而且要三秒結束。
//
// 三選一刻意不自動判定：誤判一次放鳥可能得罪一個好客人（規格 §4.2）。

export function CheckoutSheet({
  booking,
  timezone,
  onClose,
}: {
  booking: BookingRow
  timezone: string
  onClose: () => void
}) {
  const router = useRouter()
  const [amount, setAmount] = useState<number>(Number(booking.quoted_price ?? 0))
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [internalNote, setInternalNote] = useState('')
  const [confirmMiss, setConfirmMiss] = useState<'no_show' | 'cancelled' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run(outcome: 'completed' | 'no_show' | 'cancelled') {
    setError(null)
    startTransition(async () => {
      const res = await closeBooking({
        bookingId: booking.id,
        outcome,
        actualAmount: outcome === 'completed' ? amount : null,
        paymentMethod: outcome === 'completed' ? method : null,
        internalNote,
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
          <h2 className="text-[16px] font-extrabold tracking-tight">結帳</h2>
          <span className="num text-[11px] font-bold text-ink-4">
            {formatTime(booking.start_at, timezone)} 那筆
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
              {[
                booking.location_name,
                `${formatTime(booking.start_at, timezone)}–${formatTime(booking.end_at, timezone)}`,
                booking.customer_visit_count > 0
                  ? `第 ${booking.customer_visit_count + 1} 次到店`
                  : '第一次到店',
              ]
                .filter(Boolean)
                .join('　·　')}
            </p>
            {booking.note && (
              <p className="mt-1.5 text-[11.5px] text-ink-3">客人備註：{booking.note}</p>
            )}
          </div>

          <div className="mt-4">
            <Field label="實收金額" hint={`服務定價 NT$ ${money(booking.quoted_price)}，加購或折扣直接改這個數字`}>
              <NumberBox
                value={amount}
                onValueChange={setAmount}
                min={0}
                step={100}
                prefix="NT$"
              />
            </Field>

            <p className="mb-1.5 text-[11px] font-extrabold text-ink-2">付款方式</p>
            <div className="mb-3.5 flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={cn(
                    'rounded-full px-5 py-2.5 text-[12.5px] font-extrabold transition',
                    method === m.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-sunk text-ink-2 hover:text-primary'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mb-3.5 text-[10.5px] text-ink-4">
              時數券與儲值金要等券的功能做好才會出現在這裡。
            </p>

            <Field label="內部備註" optional hint="只有你看得到">
              <TextBox
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="例：下次加強右肩"
              />
            </Field>
          </div>

          <ErrorNote>{error}</ErrorNote>

          <PrimaryButton
            className="mt-2 w-full py-4 text-[14px]"
            onClick={() => run('completed')}
            disabled={pending}
          >
            {pending ? '處理中…' : `完成結帳 · NT$ ${money(amount)}`}
          </PrimaryButton>

          <div className="mt-4 border-t border-hairline pt-3">
            {confirmMiss ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-bold text-danger">
                  {confirmMiss === 'no_show'
                    ? '確定登記成沒出現？會計一次放鳥點數。'
                    : '確定取消這筆？不會計點。'}
                </span>
                <button
                  onClick={() => run(confirmMiss)}
                  disabled={pending}
                  className="rounded-full bg-danger-bg px-4 py-2 text-[12px] font-extrabold text-danger disabled:opacity-50"
                >
                  確定
                </button>
                <button
                  onClick={() => setConfirmMiss(null)}
                  disabled={pending}
                  className="rounded-full bg-sunk px-4 py-2 text-[12px] font-extrabold text-ink-3"
                >
                  不要
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setConfirmMiss('no_show')}
                  className="rounded-full bg-sunk px-4 py-2.5 text-[12px] font-extrabold text-ink-2 hover:text-danger"
                >
                  客人沒出現
                </button>
                <button
                  onClick={() => setConfirmMiss('cancelled')}
                  className="rounded-full bg-sunk px-4 py-2.5 text-[12px] font-extrabold text-ink-2 hover:text-danger"
                >
                  取消不計
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
