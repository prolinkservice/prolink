'use client'

import { useState } from 'react'
import { CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PaymentPlaceholder() {
  const [showHint, setShowHint] = useState(false)

  return (
    <div className="py-10 flex flex-col items-center text-center gap-4">
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
  )
}
