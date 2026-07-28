import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentTenant } from '@/lib/tenant'

export const metadata: Metadata = { title: '今日行程 · 職人連結' }

// 今日行程。完整版（時間軸、移動時間、待結案）在 Sprint 1 後段補上，
// 草稿見 docs/mockups/dashboard.html §01

export default async function TodayPage() {
  const current = await getCurrentTenant()
  if (!current) return null
  const { tenant } = current

  const supabase = await createServerSupabaseClient()
  const [{ count: serviceCount }, { count: customerCount }] = await Promise.all([
    supabase
      .from('services')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .eq('is_active', true),
    supabase.from('customers').select('id', { count: 'exact' }).eq('tenant_id', tenant.id),
  ])

  const today = new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(new Date())

  return (
    <main className="px-6 pt-2 pb-10">
      <div className="mb-5 flex items-baseline gap-3">
        <h1 className="text-[22px] font-extrabold tracking-tight">今日行程</h1>
        <span className="num text-xs font-bold text-ink-4">{today}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="今日預約" value="0" />
        <Stat label="服務項目" value={String(serviceCount ?? 0)} />
        <Stat label="客戶總數" value={String(customerCount ?? 0)} />
      </div>

      <div className="mt-4 rounded-lg bg-card px-6 py-14 text-center shadow-card">
        <div className="mx-auto mb-4 size-14 rounded-lg bg-accent" />
        <b className="block text-[15px] font-extrabold">今天還沒有預約</b>
        <p className="mx-auto mt-1.5 max-w-[34ch] text-[13px] text-ink-3">
          把預約連結傳給客人，他們就能自己約。也可以自己手動建立預約。
        </p>
      </div>

      <p className="mt-4 rounded-sm bg-info-bg px-4 py-3 text-[12.5px] font-semibold text-info">
        行事曆、客戶管理、服務項目設定還在做，完成後會出現在左邊選單。
      </p>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm bg-sunk px-5 py-4">
      <p className="text-[11px] font-bold text-ink-4">{label}</p>
      <p className="num mt-0.5 text-2xl leading-tight font-extrabold">{value}</p>
    </div>
  )
}
