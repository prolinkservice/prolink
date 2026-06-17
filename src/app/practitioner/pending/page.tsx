import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Clock } from 'lucide-react'

export default function PractitionerPendingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-4">
        <Clock className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">審核中</h1>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">
        您的入駐申請已成功送出！平台審核通常需要 1–3 個工作天，審核通過後您將可以登入職人後台開始接單。
      </p>
      <Button asChild variant="outline">
        <Link href="/">返回首頁</Link>
      </Button>
    </div>
  )
}
