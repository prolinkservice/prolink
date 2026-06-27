'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DayData {
  date: string
  signups: number
  bookings: number
  revenue: number
}

function fmtShortDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const MODES = [
  { key: 'signups', label: '新會員數' },
  { key: 'bookings', label: '預約數' },
  { key: 'revenue', label: '平台服務費收入' },
] as const

export function SignupTrendChart({ data }: { data: DayData[] }) {
  const [mode, setMode] = useState<'signups' | 'bookings' | 'revenue'>('bookings')

  const maxVal = Math.max(1, ...data.map((d) => d[mode]))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">近 30 天趨勢</CardTitle>
        <div className="flex gap-1.5 flex-wrap">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                mode === m.key ? 'bg-primary text-white border-primary' : 'border-input text-muted-foreground hover:border-primary'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {data.every((d) => d[mode] === 0) ? (
          <p className="text-muted-foreground text-sm text-center py-10">這段期間還沒有資料</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1 h-40 min-w-[700px]">
              {data.map((d) => {
                const value = d[mode]
                const heightPct = (value / maxVal) * 100
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6 text-[10px] bg-foreground text-white rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                      {mode === 'revenue' ? `NT$${value.toLocaleString()}` : `${value}`}
                    </div>
                    <div
                      className="w-full bg-primary rounded-t-sm min-h-[2px] transition-all"
                      style={{ height: `${Math.max(heightPct, value > 0 ? 4 : 0)}%` }}
                    />
                    <p className="text-[9px] text-muted-foreground mt-1 whitespace-nowrap">{fmtShortDate(d.date)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
