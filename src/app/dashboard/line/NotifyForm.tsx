'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, ErrorNote, Field, PrimaryButton, TextBox } from '@/components/FormBits'
import { cn } from '@/lib/utils'
import { saveNotifySettings } from './actions'

// 自動通知的設定。草稿：docs/mockups/line-notifications.html §4
//
// 這張卡要回答職人的兩個問題：
//   ① 系統到底會用我的名義發什麼？（列出來，不要讓他自己猜）
//   ② 我的免費額度會不會被發爆？（給他一個關得掉的開關）

const SENDS = [
  { when: '客人加你好友', what: '歡迎訊息＋預約按鈕', cost: '不計額度' },
  { when: '客人送出預約', what: '請他按確認（24 小時內的預約直接成立）', cost: '1 則' },
  { when: '客人按了確認', what: '一句「到時候見」', cost: '不計額度' },
  { when: '你取消預約', what: '取消卡片＋重新預約按鈕', cost: '1 則' },
  { when: '客人自己取消', what: '通知你，時段已釋出', cost: '1 則' },
]

export function NotifyForm({
  plan,
  connected,
  notifySelfOnNewBooking,
  welcomeMessage,
}: {
  plan: 'free' | 'pro'
  connected: boolean
  notifySelfOnNewBooking: boolean
  welcomeMessage: string
}) {
  const router = useRouter()
  const [notifySelf, setNotifySelf] = useState(notifySelfOnNewBooking)
  const [greeting, setGreeting] = useState(welcomeMessage)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await saveNotifySettings({
        notifySelfOnNewBooking: notifySelf,
        welcomeMessage: greeting,
      })
      if (!res.ok) return setError(res.error)
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <Card
      title="自動通知"
      right={
        plan === 'pro' && (
          <>
            {saved && <span className="text-[11.5px] font-extrabold text-ok">已儲存</span>}
            <PrimaryButton onClick={save} disabled={pending}>
              {pending ? '儲存中…' : '儲存'}
            </PrimaryButton>
          </>
        )
      }
    >
      <div className="px-5 pt-1 pb-5">
        {/* 免費方案一則都不發是刻意的，但一定要在他接完官方帳號之前就講清楚，
            不要讓他接了半天才發現沒東西發得出去（2026-08-02 定案） */}
        {plan === 'free' ? (
          <div className="rounded-sm bg-warn-bg px-4 py-3.5">
            <b className="block text-[13px] font-extrabold text-warn">
              體驗方案不發送任何通知
            </b>
            <p className="mt-1 text-[12px] leading-relaxed font-semibold text-warn">
              預約確認、行前提醒、取消通知都要升級才會啟用。
              現在客人約完之後只會看到網頁上的成功畫面，你則是靠後台的紅點知道有新預約。
            </p>
          </div>
        ) : !connected ? (
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            先在上面接上你自己的官方帳號，系統才發得出通知。
          </p>
        ) : null}

        <ul className="mt-3.5 border-t border-hairline">
          {SENDS.map((s) => (
            <li
              key={s.when}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-hairline py-2.5 last:border-b-0"
            >
              <b className="w-[9em] shrink-0 text-[12.5px] font-extrabold">{s.when}</b>
              <span className="min-w-[14ch] flex-1 text-[12.5px] text-ink-2">{s.what}</span>
              <span
                className={cn(
                  'num shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold',
                  s.cost === '不計額度' ? 'bg-ok-bg text-ok' : 'bg-sunk text-ink-3'
                )}
              >
                {s.cost}
              </span>
            </li>
          ))}
        </ul>

        {plan === 'pro' && (
          <>
            <button
              type="button"
              onClick={() => setNotifySelf((v) => !v)}
              className="mt-4 flex w-full items-start gap-2.5 rounded-sm bg-sunk px-4 py-3 text-left"
            >
              <span
                className={cn(
                  'mt-px grid size-[19px] shrink-0 place-items-center rounded-[6px] text-[12px] font-extrabold',
                  notifySelf ? 'bg-primary text-primary-foreground' : 'bg-card text-transparent'
                )}
              >
                ✓
              </span>
              <span className="text-[13px] font-bold text-ink-2">
                有新預約時也通知我
                <small className="mt-0.5 block text-[11.5px] font-semibold text-ink-3">
                  關掉可省下約四分之一的額度。你仍然會在後台看到新預約。
                </small>
              </span>
            </button>

            <div className="mt-3.5">
              <Field
                label="加好友的第一句話"
                optional
                hint="留空就用系統預設。下面那張「立即預約」卡片會自動帶上你的營業時間與據點"
              >
                <TextBox
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder="謝謝你加入我的 LINE，有需要預約直接按下面的按鈕就可以。"
                />
              </Field>
            </div>

            <p className="mt-1 rounded-sm bg-sunk px-4 py-3 text-[11.5px] leading-relaxed text-ink-3">
              <b className="text-ink-2">客人是怎麼被認出來的：</b>
              歡迎訊息裡那顆「立即預約」按鈕帶著一組只有系統解得開的記號。
              客人從那顆按鈕進來預約、填了手機，兩邊才接得起來。
              自己存網址或從官網進來的客人綁不到，客戶名單上會標「LINE 未綁」。
            </p>
          </>
        )}

        <ErrorNote>{error}</ErrorNote>
      </div>
    </Card>
  )
}
