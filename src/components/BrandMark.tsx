import Link from 'next/link'
import Image from 'next/image'

export function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-1.5 shrink-0 ml-auto">
      <Image src="/logo-icon.png" alt="職人連結" width={28} height={20} className="h-6 w-auto object-contain" />
      <span className="font-bold text-sm text-foreground">職人連結</span>
    </Link>
  )
}
