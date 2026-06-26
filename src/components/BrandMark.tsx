import Link from 'next/link'

export function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-1.5 shrink-0 ml-auto">
      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
        <span className="text-white font-bold text-xs">P</span>
      </div>
      <span className="font-bold text-sm text-foreground">職人連結</span>
    </Link>
  )
}
