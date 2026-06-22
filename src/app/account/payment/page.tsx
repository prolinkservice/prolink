import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PaymentPlaceholder } from './PaymentPlaceholder'

export default function AccountPaymentPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/account">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold text-lg">付款方式</span>
      </div>

      <div className="px-4 max-w-lg mx-auto">
        <PaymentPlaceholder />
      </div>
    </div>
  )
}
