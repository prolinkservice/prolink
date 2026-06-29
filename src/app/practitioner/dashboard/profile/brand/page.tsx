import Link from 'next/link'
import { ChevronLeft, Rows3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BrandForm } from './BrandForm'
import { LayoutBuilderForm } from '../layout-builder/LayoutBuilderForm'
import { BrandMark } from '@/components/BrandMark'

export default function BrandPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="lg:hidden sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/practitioner/dashboard">
          <Button variant="ghost" size="icon"><ChevronLeft className="w-5 h-5" /></Button>
        </Link>
        <span className="font-semibold text-lg">品牌頁面</span>
      <BrandMark />
      </div>

      <div className="px-4 py-6 max-w-lg lg:max-w-5xl mx-auto flex flex-col gap-5">
        <BrandForm />

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Rows3 className="w-4 h-4 text-primary" />
              首頁編排
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LayoutBuilderForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
