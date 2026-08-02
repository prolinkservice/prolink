'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, ErrorNote, Field, PrimaryButton, TextBox } from '@/components/FormBits'
import { saveContact } from './actions'

export function ContactForm({
  lineFriendUrl,
  contactPhone,
  plan,
}: {
  lineFriendUrl: string
  contactPhone: string
  plan: 'free' | 'pro'
}) {
  const router = useRouter()
  const [url, setUrl] = useState(lineFriendUrl)
  const [phone, setPhone] = useState(contactPhone)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await saveContact({ lineFriendUrl: url, contactPhone: phone })
      if (!res.ok) return setError(res.error)
      setSaved(true)
      router.refresh()
    })
  }

  return (
    <>
      <Card
        title="加好友連結"
        right={
          <>
            {saved && <span className="text-[11.5px] font-extrabold text-ok">已儲存</span>}
            <PrimaryButton onClick={save} disabled={pending}>
              {pending ? '儲存中…' : '儲存'}
            </PrimaryButton>
          </>
        }
      >
        <div className="px-5 pt-1 pb-5">
          <p className="mb-4 text-[12.5px] leading-relaxed text-ink-3">
            客人預約成功的那一頁會出現一張「加店家 LINE」的按鈕，連到這條網址。
            {plan === 'free' &&
              '你目前是體驗方案，系統不會自動發任何通知，所以這條連結是客人唯一找得到你的地方。'}
          </p>

          <Field
            label="LINE 加好友連結"
            hint="到 LINE 官方帳號管理後台 →「增加好友人數」→ 複製網址。長得像 https://lin.ee/xxxxxxx"
          >
            <TextBox
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://lin.ee/xxxxxxx"
              inputMode="url"
            />
          </Field>

          <Field label="聯絡電話" optional hint="約不到時段的客人會看到，可以直接撥給你">
            <TextBox
              className="num"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0912345678"
              inputMode="tel"
            />
          </Field>

          <ErrorNote>{error}</ErrorNote>
        </div>
      </Card>

    </>
  )
}
