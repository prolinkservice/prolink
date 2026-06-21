import Link from 'next/link'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CheckEmailPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Mail className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-xl font-bold">請確認你的信箱</h1>
      <p className="text-muted-foreground text-sm max-w-xs">
        我們已寄出一封驗證信，請點擊信中的連結完成註冊
      </p>
      <Button asChild variant="outline">
        <Link href="/">回首頁</Link>
      </Button>
    </div>
  )
}
