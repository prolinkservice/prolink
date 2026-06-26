import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddressForm } from './AddressForm'
import { BrandMark } from '@/components/BrandMark'

export default function ShopAddressPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="lg:hidden sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/practitioner/dashboard/profile">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold text-lg">店家地址</span>
      <BrandMark />
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <AddressForm />
      </div>
    </div>
  )
}
