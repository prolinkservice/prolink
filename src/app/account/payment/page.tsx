'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AccountPaymentPage() {
  const [showHint, setShowHint] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/account">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold text-lg">付款方式</span>
      </div>

      <div className="px-4 py-16 max-w-lg mx-auto flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
          <CreditCard className="w-7 h-7 text-primary" />
        </div>
        <p className="text-muted-foreground text-sm">尚未新增付款方式</p>
        <Button onClick={() => setShowHint(true)} className="active:scale-95 transition-transform">
          新增付款方式
        </Button>
        {showHint && (
          <p className="text-xs text-muted-foreground">此功能即將推出</p>
        )}
      </div>
    </div>
  )
}
