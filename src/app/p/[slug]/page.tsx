import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PractitionerPage from '../../practitioners/[id]/page'

// 老師自訂的好記網址（例如放在 IG 簡介），實際上沿用 /practitioners/[id] 的完整頁面渲染邏輯，
// 只是先用 slug 換成真正的 practitioner id，避免維護兩份幾乎一樣的頁面
export default async function PractitionerSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('id')
    .eq('slug', slug)
    .eq('status', 'approved')
    .single()

  if (!practitioner) notFound()

  return PractitionerPage({ params: Promise.resolve({ id: practitioner.id }) })
}
