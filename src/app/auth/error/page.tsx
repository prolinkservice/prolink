import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const { message } = await searchParams

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-xl font-bold mb-2">登入發生問題</h1>
        <p className="text-muted-foreground text-sm mb-6">{message ?? '請重試或聯絡客服'}</p>
        <Button asChild>
          <Link href="/">回首頁</Link>
        </Button>
      </div>
    </div>
  )
}
