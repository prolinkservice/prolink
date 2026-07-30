import { redirect } from 'next/navigation'
import { safeNextPath } from '@/lib/next-path'

// 舊的登入頁只有帳號密碼，是媒合時代留下來的。
// 職人多半用 Google 或 LINE 登入，停在這頁會找不到那兩顆按鈕，
// 所以一律轉到 /auth，順便把要去的地方帶過去。

type Props = { searchParams: Promise<{ next?: string }> }

export default async function LegacyLoginPage({ searchParams }: Props) {
  const { next } = await searchParams
  redirect(`/auth?next=${encodeURIComponent(safeNextPath(next, '/dashboard'))}`)
}
