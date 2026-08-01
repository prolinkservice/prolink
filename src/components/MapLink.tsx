import { mapsDirectionsUrl, mapsSearchUrl } from '@/lib/maps'
import { cn } from '@/lib/utils'

// 地址在畫面上一定要能點。老師在路上、客人在找路，
// 兩邊都是單手拿手機，所以觸控區一律 44px——
// 塞在敘述裡的一行小字，手指按十次有三次按不到，
// 那看起來就像「點了打不開」。
//
// 兩種樣子，用途決定行為，不另外開參數：
//   button 是獨立的一顆「開啟導航」，直接進導航模式
//   text   是把地址本身變成連結，只是開地圖看在哪

export function MapLink({
  address,
  label,
  variant = 'button',
  className,
}: {
  address: string | null | undefined
  label?: string
  variant?: 'button' | 'text'
  className?: string
}) {
  const url = variant === 'button' ? mapsDirectionsUrl(address) : mapsSearchUrl(address)
  if (!url) return null

  const shown = (address ?? '').trim()
  const text = label ?? (variant === 'text' ? shown : '開啟導航')

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`在 Google 地圖${variant === 'button' ? '導航到' : '查看'} ${shown}`}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 font-extrabold text-primary transition',
        variant === 'button'
          ? 'rounded-full bg-sunk px-4 text-[12px] hover:bg-accent hover:text-accent-foreground'
          : 'text-[11.5px] underline decoration-primary/30 underline-offset-4 hover:decoration-primary',
        className
      )}
    >
      <span aria-hidden className="text-[13px] leading-none">
        ◎
      </span>
      {text}
    </a>
  )
}
