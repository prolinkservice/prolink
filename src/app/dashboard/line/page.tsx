import type { Metadata } from 'next'
import { getCurrentTenant } from '@/lib/tenant'
import { ContactForm } from './ContactForm'

export const metadata: Metadata = { title: 'LINE 官方帳號 · 職人連結' }

// 現階段只做「客人找得到你」這件事。
// 自帶官方帳號的 Messaging API 憑證、圖文選單、用量看板在 Sprint 2。

export default async function LinePage() {
  const current = await getCurrentTenant()
  if (!current) return null
  const { tenant } = current

  return (
    <main className="pb-10">
      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-[21px] font-extrabold tracking-tight">LINE 官方帳號</h1>
        <p className="text-[12.5px] text-ink-3">客人約完之後，要找得到你。</p>
      </div>

      <ContactForm
        lineFriendUrl={tenant.line_friend_url ?? ''}
        contactPhone={tenant.contact_phone ?? ''}
        plan={tenant.plan}
      />
    </main>
  )
}
