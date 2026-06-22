import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SocialForm } from './SocialForm'

export default function SocialLinksPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/practitioner/dashboard/profile">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold text-lg">社群連結</span>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        <SocialForm />
      </div>
    </div>
  )
}
