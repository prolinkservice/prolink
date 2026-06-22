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
}

export function SettingsListItem({ icon: Icon, label, sublabel, href, badge }: SettingsListItemProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5 bg-white hover:bg-muted/50 active:scale-[0.99] transition-all"
    >
      <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
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
