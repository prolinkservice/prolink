'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, ErrorNote, Field, PrimaryButton, TextArea } from '@/components/FormBits'
import { cn } from '@/lib/utils'
import { saveNotifySettings } from './actions'

// 自動通知的設定。草稿：docs/mockups/line-notifications.html §4
//
// 這張卡要回答職人的兩個問題：
//   ① 系統到底會用我的名義發什麼？（列出來，不要讓他自己猜）
//   ② 我的免費額度會不會被發爆？（給他一個關得掉的開關）

const SENDS = [
  { when: '客人加你好友', what: '歡迎訊息＋預約按鈕', cost: '不計額度' },
  { when: '客人打「預約」', what: '回一張立即預約卡片', cost: '不計額度' },
  { when: '客人送出預約', what: '請他按確認（24 小時內的預約直接成立）', cost: '1 則' },
  { when: '客人按了確認', what: '一句「到時候見」', cost: '不計額度' },
  { when: '預約前一天中午', what: '行前提醒＋「我無法前往」', cost: '1 則' },
  { when: '你取消預約', what: '取消卡片＋重新預約按鈕', cost: '1 則' },
  { when: '客人自己取消', what: '通知你，時段已釋出', cost: '1 則' },
]

export function NotifyForm({
  plan,
  connected,
  notifySelfOnNewBooking,
  welcomeMessage,
  defaultWelcome,
  testMode: initialTestMode,
  reminderEnabled: initialReminderEnabled,
  reminderNote: initialReminderNote,
  operatorBound,
}: {
  plan: 'free' | 'pro'
  connected: boolean
  notifySelfOnNewBooking: boolean
  welcomeMessage: string
  /** 沒自己寫的話會發這一段。放在提示框裡讓職人看得到現在到底發什麼 */
  defaultWelcome: string
  testMode: boolean
  reminderEnabled: boolean
  /** 接在提醒訊息裡的一句話，例如「三樓沒有電梯」 */
  reminderNote: string
  /** 沒綁定自己的 LINE 就打開測試模式，等於誰都收不到 */
  operatorBound: boolean
}) {
  const router = useRouter()
  const [notifySelf, setNotifySelf] = useState(notifySelfOnNewBooking)
  const [testMode, setTestMode] = useState(initialTestMode)
  const [greeting, setGreeting] = useState(welcomeMessage)
  const [reminder, setReminder] = useState(initialReminderEnabled)
  const [reminderNote, setReminderNote] = useState(initialReminderNote)
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
        testMode,
        reminderEnabled: reminder,
        reminderNote,
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
        {/* 測試模式擺在最上面而且要夠大。這是唯一一個「開著的時候，
            所有東西看起來都壞掉」的設定——忘記它開著，會花一小時
            debug 一個根本沒壞的系統 */}
        {plan === 'pro' && (
          <div
            className={cn(
              'mb-4 rounded-sm px-4 py-3.5',
              testMode ? 'bg-warn-bg' : 'bg-sunk'
            )}
          >
            <button
              type="button"
              onClick={() => setTestMode((v) => !v)}
              className="flex w-full items-start gap-2.5 text-left"
            >
              <span
                className={cn(
                  'mt-px grid size-[19px] shrink-0 place-items-center rounded-[6px] text-[12px] font-extrabold',
                  testMode ? 'bg-warn text-white' : 'bg-card text-transparent'
                )}
              >
                ✓
              </span>
              <span className={cn('text-[13px] font-extrabold', testMode && 'text-warn')}>
                測試模式
                <small
                  className={cn(
                    'mt-0.5 block text-[11.5px] leading-relaxed font-semibold',
                    testMode ? 'text-warn' : 'text-ink-3'
                  )}
                >
                  {testMode
                    ? '進行中：所有 LINE 訊息只發給你自己，真實客人一則都收不到。要正式啟用記得關掉。'
                    : '打開之後，系統發出的 LINE 訊息只會送到你自己綁定的帳號。導入期想先自己試、又不想動到既有客人時用。'}
                </small>
              </span>
            </button>

            {testMode && !operatorBound && (
              <p className="mt-2.5 rounded-sm bg-danger-bg px-3.5 py-2.5 text-[11.5px] leading-relaxed font-bold text-danger">
                你還沒把自己的 LINE 綁上來，所以現在等於誰都收不到訊息。
                先到上面用綁定碼綁一次。
              </p>
            )}
          </div>
        )}

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
            {/* 行前提醒放在第一個：這是他付費之後最有感的一則，
                也是唯一一個「客人會回訊息給你」的通知 */}
            <button
              type="button"
              onClick={() => setReminder((v) => !v)}
              className="mt-4 flex w-full items-start gap-2.5 rounded-sm bg-sunk px-4 py-3 text-left"
            >
              <span
                className={cn(
                  'mt-px grid size-[19px] shrink-0 place-items-center rounded-[6px] text-[12px] font-extrabold',
                  reminder ? 'bg-primary text-primary-foreground' : 'bg-card text-transparent'
                )}
              >
                ✓
              </span>
              <span className="text-[13px] font-bold text-ink-2">
                前一天中午提醒客人
                <small className="mt-0.5 block text-[11.5px] font-semibold text-ink-3">
                  每天 12:00 提醒明天要來的客人，訊息裡附「我無法前往」。
                  他前一天就說不能來，那個時段還賣得掉。每筆多 1 則額度。
                </small>
              </span>
            </button>

            {reminder && (
              <div className="mt-2.5">
                <Field
                  label="提醒訊息裡加一句自己的話"
                  optional
                  hint="例如「三樓沒有電梯，請走樓梯」「停車場在後棟」。留空就不加"
                >
                  <TextArea
                    value={reminderNote}
                    onChange={(e) => setReminderNote(e.target.value)}
                    placeholder="三樓沒有電梯，請走樓梯。"
                    rows={2}
                    maxLength={200}
                  />
                </Field>
                <p className="num -mt-1 text-[11.5px] text-ink-3">{reminderNote.length} / 200 字</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setNotifySelf((v) => !v)}
              className="mt-3 flex w-full items-start gap-2.5 rounded-sm bg-sunk px-4 py-3 text-left"
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
                hint="可以換行、可以放表情符號。留空就用下面灰字那段預設。這句話下面會自動接一張「立即預約」卡片，帶著你的營業時間與據點"
              >
                {/* 歡迎詞通常是三段式（打招呼／怎麼預約／有問題找我），
                    塞在單行輸入框裡沒人打得下去 */}
                <TextArea
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder={defaultWelcome}
                  rows={5}
                  maxLength={500}
                />
              </Field>
              <div className="-mt-1 flex flex-wrap items-baseline gap-x-3 text-[11.5px] text-ink-3">
                <span className="num">{greeting.length} / 500 字</span>
                {greeting.trim() && (
                  <button
                    type="button"
                    onClick={() => setGreeting('')}
                    className="font-extrabold text-primary"
                  >
                    改回預設
                  </button>
                )}
              </div>
            </div>

            <p className="mt-1 rounded-sm bg-sunk px-4 py-3 text-[11.5px] leading-relaxed text-ink-3">
              <b className="text-ink-2">客人是怎麼被認出來的：</b>
              歡迎訊息裡那顆「立即預約」按鈕帶著一組只有系統解得開的記號。
              客人從那顆按鈕進來預約、填了手機，兩邊才接得起來。
              客人在對話裡打「預約」「我要預約」也會拿到同一張卡片——
              早就加了好友、歡迎訊息已經滑不見的舊客人靠這條補綁。
              <br />
              對不上的訊息系統一律不回，留給你自己回。自己存網址或從官網進來的客人綁不到，
              客戶名單上會標「LINE 未綁」。
            </p>
          </>
        )}

        <ErrorNote>{error}</ErrorNote>
      </div>
    </Card>
  )
}
