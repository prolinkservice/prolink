'use client'

// 後台設定頁共用的小元件。方案 B 的規矩：輸入框用凹陷底色、不用邊框，
// 聚焦時才浮起來變白。集中在這裡，改一次全站一致。
// 來源：docs/mockups/design-system.html

import { cn } from '@/lib/utils'

const INPUT_BASE =
  'w-full rounded-sm bg-sunk px-3.5 py-3 text-[13.5px] outline-none transition ' +
  'focus:bg-card focus:shadow-[0_0_0_3px_var(--accent)] disabled:opacity-50'

export function Field({
  label,
  hint,
  optional,
  isNew,
  children,
  className,
}: {
  label: string
  hint?: string
  optional?: boolean
  /** 因為店裡變複雜才冒出來的欄位，標一下老師才知道為什麼多了東西 */
  isNew?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3.5', className)}>
      <label className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-extrabold text-ink-2">
        {label}
        {optional && <span className="font-bold text-ink-3">· 選填</span>}
        {isNew && (
          <span className="rounded-full bg-info-bg px-2 py-0.5 text-[9px] font-extrabold text-info">
            新出現
          </span>
        )}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-3">{hint}</p>}
    </div>
  )
}

export function TextBox({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(INPUT_BASE, className)} />
}

export function SelectBox({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(INPUT_BASE, 'appearance-none font-semibold', className)}
    />
  )
}

/** 帶單位的數字輸入。數字一律等寬對齊（設計鐵則 3） */
export function NumberBox({
  value,
  onValueChange,
  prefix,
  suffix,
  className,
  ...props
}: {
  value: number | null
  onValueChange: (value: number) => void
  prefix?: string
  suffix?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <div
      className={cn(
        'flex items-center rounded-sm bg-sunk focus-within:bg-card focus-within:shadow-[0_0_0_3px_var(--accent)]',
        className
      )}
    >
      {prefix && (
        <span className="pl-3.5 text-[11.5px] font-bold whitespace-nowrap text-ink-3">
          {prefix}
        </span>
      )}
      <input
        {...props}
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        onChange={(e) => onValueChange(Number(e.target.value))}
        className="num min-w-0 flex-1 bg-transparent px-3 py-3 text-[13.5px] font-extrabold outline-none"
      />
      {suffix && (
        <span className="pr-3.5 text-[11.5px] font-bold whitespace-nowrap text-ink-3">
          {suffix}
        </span>
      )}
    </div>
  )
}

export function ToggleRow({
  title,
  desc,
  on,
  onToggle,
  children,
}: {
  title: string
  desc: string
  on: boolean
  onToggle: (next: boolean) => void
  /** 開關打開後才顯示的細項設定 */
  children?: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-3 py-3">
        <div className="min-w-0">
          <b className="block text-[13.5px] font-extrabold">{title}</b>
          <p className="text-[11.5px] text-ink-3">{desc}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={title}
          onClick={() => onToggle(!on)}
          className={cn(
            'relative ml-auto h-6.5 w-11 shrink-0 rounded-full transition',
            on ? 'bg-primary' : 'bg-ink-4'
          )}
        >
          <span
            className={cn(
              'absolute top-[3px] left-[3px] size-5 rounded-full bg-white transition-transform',
              on && 'translate-x-[18px]'
            )}
          />
        </button>
      </div>
      {on && children && <div className="pb-3">{children}</div>}
    </div>
  )
}

export function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'rounded-full px-4 py-2.5 text-[12.5px] font-extrabold transition',
        on
          ? 'bg-primary text-primary-foreground'
          : 'bg-card text-ink-3 shadow-soft hover:text-primary'
      )}
    >
      {children}
    </button>
  )
}

export function PrimaryButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'rounded-full bg-primary px-5 py-2.5 text-[13px] font-extrabold text-primary-foreground transition hover:brightness-95 disabled:opacity-50',
        className
      )}
    />
  )
}

export function QuietButton({
  className,
  danger,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      {...props}
      className={cn(
        'rounded-full bg-sunk px-5 py-2.5 text-[13px] font-extrabold transition disabled:opacity-50',
        danger
          ? 'text-danger hover:bg-danger-bg'
          : 'text-ink-2 hover:bg-accent hover:text-accent-foreground',
        className
      )}
    />
  )
}

/** 錯誤訊息一律顯示原因，不要只說「失敗」 */
export function ErrorNote({ children }: { children: React.ReactNode }) {
  if (!children) return null
  return (
    <p className="mt-3 rounded-sm bg-danger-bg px-3.5 py-2.5 text-[12.5px] font-bold text-danger">
      {children}
    </p>
  )
}

export function Card({
  title,
  sub,
  right,
  children,
}: {
  title: string
  sub?: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mb-4 rounded-lg bg-card shadow-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 pt-4.5 pb-1">
        <h2 className="text-[15.5px] font-extrabold tracking-tight">{title}</h2>
        {sub && <span className="text-[12px] font-bold text-ink-3">{sub}</span>}
        {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
      </header>
      {children}
    </section>
  )
}
