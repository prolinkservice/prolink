import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { lookupTenantBySlug } from '@/lib/tenant'
import { Stamp } from '@/components/Stamp'

// 職人的公開預約頁。網址是 prolink.tw/p/{slug}，
// 職人改過 slug 之後舊網址會 301 轉到新的，
// 名片上印的、LINE 對話裡的舊連結才不會死掉。

type Props = { params: Promise<{ slug: string }> }

type PublicService = {
  id: string
  name: string
  category: string | null
  duration_mode: 'fixed' | 'hourly'
  duration_min: number | null
  price: number
  price_unit: 'per_session' | 'per_hour' | 'per_person'
  location_mode: 'fixed' | 'multi_site' | 'mobile'
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const found = await lookupTenantBySlug(slug)
  if (found.kind !== 'found') return { title: '找不到這個頁面' }
  return {
    title: `${found.tenant.name} · 線上預約`,
    description: `${found.tenant.name}的線上預約頁面，選好時段直接預約。`,
  }
}

export default async function TenantPublicPage({ params }: Props) {
  const { slug } = await params
  const found = await lookupTenantBySlug(slug)

  if (found.kind === 'moved') permanentRedirect(`/p/${found.slug}`)
  if (found.kind === 'missing') notFound()

  const { tenant } = found
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('services')
    .select(
      'id, name, category, duration_mode, duration_min, price, price_unit, location_mode'
    )
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const services = (data ?? []) as PublicService[]

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-5 py-10">
      <header className="text-center">
        <Stamp name={tenant.name} className="mx-auto size-14 text-xl" />
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{tenant.name}</h1>
        <p className="mt-1.5 text-[13px] text-ink-3">選擇服務後挑時段，不用註冊</p>
      </header>

      <section className="mt-8">
        <h2 className="mb-2.5 px-1 text-[11px] font-extrabold tracking-[0.1em] text-ink-4">
          選擇服務
        </h2>

        {services.length === 0 ? (
          <div className="rounded-lg bg-sunk px-5 py-10 text-center">
            <p className="text-[14px] font-extrabold">目前還沒有開放的服務</p>
            <p className="mt-1.5 text-[12.5px] text-ink-3">請直接聯繫店家安排時間。</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {services.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/p/${tenant.slug}/book?service=${s.id}`}
                  className="flex w-full items-center gap-3 rounded-lg bg-card px-4 py-3.5 text-left shadow-soft transition hover:shadow-card"
                >
                  <div className="min-w-0 flex-1">
                    <b className="block text-[14px] font-bold tracking-tight">{s.name}</b>
                    <p className="mt-0.5 text-[11.5px] text-ink-3">{describeService(s)}</p>
                  </div>
                  <span className="num shrink-0 text-[14px] font-extrabold">
                    {formatPrice(s)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 有疑問的客人要找得到人。免費方案沒有任何自動通知，這張卡更重要 */}
      {(tenant.line_friend_url || tenant.contact_phone) && (
        <section className="mt-6 flex flex-wrap justify-center gap-2">
          {tenant.line_friend_url && (
            <a
              href={tenant.line_friend_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#06C755] px-5 py-3 text-[12.5px] font-extrabold text-white"
            >
              加 {tenant.name} 的 LINE
            </a>
          )}
          {tenant.contact_phone && (
            <a
              href={`tel:${tenant.contact_phone}`}
              className="num rounded-full bg-card px-5 py-3 text-[12.5px] font-extrabold shadow-soft"
            >
              {tenant.contact_phone}
            </a>
          )}
        </section>
      )}

      <p className="mt-8 text-center text-[11px] text-ink-4">由 職人連結 提供預約服務</p>
    </main>
  )
}

function describeService(s: PublicService): string {
  const parts: string[] = []

  if (s.duration_mode === 'hourly') parts.push('按小時計費')
  else if (s.duration_min) parts.push(`${s.duration_min} 分鐘`)

  if (s.location_mode === 'mobile') parts.push('到府服務')
  else if (s.location_mode === 'multi_site') parts.push('多據點')

  if (s.category) parts.push(s.category)

  return parts.join(' · ')
}

function formatPrice(s: PublicService): string {
  const n = Number(s.price).toLocaleString('zh-TW')
  if (s.price_unit === 'per_hour') return `${n}/時`
  if (s.price_unit === 'per_person') return `${n}/人`
  return n
}
