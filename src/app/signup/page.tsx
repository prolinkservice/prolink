import { redirect } from 'next/navigation'
import { safeNextPath } from '@/lib/next-path'

// 同 /login：舊的註冊頁沒有 Google 與 LINE，一律轉到 /auth 的註冊分頁。

type Props = { searchParams: Promise<{ next?: string }> }

export default async function LegacySignupPage({ searchParams }: Props) {
  const { next } = await searchParams
  redirect(`/auth?mode=signup&next=${encodeURIComponent(safeNextPath(next, '/dashboard'))}`)
}
