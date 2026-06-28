import Link from 'next/link'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SettingsListItemProps {
  icon: LucideIcon
  label: string
  sublabel?: ReactNode
  href: string
  badge?: ReactNode
  /** 子項目縮排顯示，用於表示從屬於上一個項目（例如服務管理下的時段管理/預約管理） */
  indent?: boolean
}

export function SettingsListItem({ icon: Icon, label, sublabel, href, badge, indent }: SettingsListItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 bg-white hover:bg-muted/50 active:scale-[0.99] transition-all',
        indent ? 'pl-10 pr-4 py-2.5' : 'px-4 py-3.5'
      )}
    >
      <div className={cn('rounded-full bg-accent flex items-center justify-center shrink-0', indent ? 'w-7 h-7' : 'w-9 h-9')}>
        <Icon className={cn('text-primary', indent ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-medium', indent ? 'text-sm text-muted-foreground' : 'text-sm text-foreground')}>{label}</p>
        {sublabel && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{sublabel}</p>
        )}
      </div>
      {badge}
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </Link>
  )
}

export function SettingsListGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-white divide-y divide-border overflow-hidden', className)}>
      {children}
    </div>
  )
}
