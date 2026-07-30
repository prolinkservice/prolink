import { cn } from '@/lib/utils'

// 陶印：缺角的方章，取店名第一個字。
// 不用圓形頭像也不用圓角方塊——那是每個 SaaS 都長的樣子。
// 兩個對角切小、兩個對角留大，看起來才像蓋出來的印，不像沒對齊的圓角。

export function Stamp({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-[11px_3px_11px_3px] bg-primary font-extrabold text-primary-foreground',
        className
      )}
    >
      {name.slice(0, 1)}
    </span>
  )
}
