import Link from 'next/link'
import { FaLine } from 'react-icons/fa6'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/BrandMark'

const LINE_OA_ADD_FRIEND_URL = 'https://lin.ee/5QOra33'

export default async function LineAddedPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const continueTo = next || '/'

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <BrandMark />
      <div className="w-16 h-16 rounded-full bg-[#06C755]/10 flex items-center justify-center mb-4 mt-4">
        <FaLine className="w-8 h-8 text-[#06C755]" />
      </div>
      <h1 className="text-xl font-bold mb-2">LINE 登入成功</h1>
      <p className="text-muted-foreground text-sm mb-6 max-w-xs">
        記得加入「職人連結 ProLink」官方 LINE 好友，才能收到預約、付款、老師確認接單等通知喔！
      </p>

      <Button asChild size="lg" className="w-full max-w-xs gap-2 bg-[#06C755] hover:bg-[#05b34c] text-white mb-3">
        <a href={LINE_OA_ADD_FRIEND_URL} target="_blank" rel="noopener noreferrer">
          <FaLine className="w-5 h-5" />
          加入官方 LINE 好友
        </a>
      </Button>

      <Button asChild size="lg" variant="outline" className="w-full max-w-xs">
        <Link href={continueTo}>稍後再加，先繼續</Link>
      </Button>
    </div>
  )
}
