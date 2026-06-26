import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VerificationForm } from './VerificationForm'
import { BrandMark } from '@/components/BrandMark'

export default function VerificationPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="lg:hidden sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/practitioner/dashboard/profile">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold text-lg">身份與收款資料</span>
      <BrandMark />
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <VerificationForm />
      </div>
    </div>
  )
}
