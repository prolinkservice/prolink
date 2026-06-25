'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, NotebookPen } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Student } from './page'
import { ClientNoteEditor } from '../bookings/ClientNoteEditor'

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'secondary' | 'destructive'> = {
  pending: 'default',
  confirmed: 'secondary',
  completed: 'outline',
  cancelled: 'destructive',
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '時段未知'
  return new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function StudentList({ students, statusLabel }: { students: Student[]; statusLabel: Record<string, string> }) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {students.map(s => {
        const isOpen = openId === s.customerId
        const latest = s.bookings[0]
        return (
          <Card key={s.customerId}>
            <CardContent className="p-4">
              <button
                type="button"
                className="w-full flex items-center gap-3 text-left"
                onClick={() => setOpenId(isOpen ? null : s.customerId)}
              >
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarImage src={s.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-accent text-foreground font-semibold">
                    {s.displayName?.[0] ?? '客'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{s.displayName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    預約 {s.bookingCount} 次｜最近：{latest?.serviceName ?? '服務項目'} {fmtDateTime(latest?.startTime ?? null)}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[latest?.status ?? ''] ?? 'outline'}>
                  {statusLabel[latest?.status ?? ''] ?? latest?.status}
                </Badge>
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
              </button>

              {isOpen && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <NotebookPen className="w-3.5 h-3.5" />
                    歷史預約紀錄
                  </p>
                  <div className="space-y-2 mb-1">
                    {s.bookings.map(b => (
                      <div key={b.id} className="flex items-center justify-between text-xs bg-muted/40 rounded-md px-3 py-2">
                        <span>{b.serviceName ?? '服務項目'}｜{fmtDateTime(b.startTime)}</span>
                        <Badge variant={STATUS_VARIANT[b.status] ?? 'outline'} className="text-[10px] px-1.5 py-0">
                          {statusLabel[b.status] ?? b.status}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <ClientNoteEditor customerId={s.customerId} />
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
