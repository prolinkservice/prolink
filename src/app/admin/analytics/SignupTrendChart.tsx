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
  { key: 'signups', label: '新會員數', unit: '人' },
  { key: 'bookings', label: '預約數', unit: '筆' },
  { key: 'revenue', label: '平台服務費收入', unit: '元' },
] as const

function fmtValue(mode: (typeof MODES)[number]['key'], value: number) {
  return mode === 'revenue' ? `NT$${value.toLocaleString()}` : `${value}`
}

export function SignupTrendChart({ data }: { data: DayData[] }) {
  const [mode, setMode] = useState<'signups' | 'bookings' | 'revenue'>('bookings')
  const activeMode = MODES.find((m) => m.key === mode)!

  const maxVal = Math.max(1, ...data.map((d) => d[mode]))
  const total = data.reduce((sum, d) => sum + d[mode], 0)
  const hasData = total > 0

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
        <p className="text-sm text-muted-foreground mb-3">
          近 30 天合計
          <span className="text-foreground font-bold text-lg mx-1.5">{fmtValue(mode, total)}</span>
          {activeMode.unit}
        </p>

        {!hasData ? (
          <p className="text-muted-foreground text-sm text-center py-10">這段期間還沒有{activeMode.label}資料</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1 h-44 min-w-[900px] border-b border-border">
              {data.map((d) => {
                const value = d[mode]
                const heightPct = (value / maxVal) * 100
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full relative">
                    {value > 0 && (
                      <p className="text-[9px] text-foreground font-medium mb-0.5 whitespace-nowrap">
                        {mode === 'revenue' ? value.toLocaleString() : value}
                      </p>
                    )}
                    <div
                      className="w-full bg-primary rounded-t-sm transition-all"
                      style={{ height: value > 0 ? `${Math.max(heightPct, 4)}%` : '1px', backgroundColor: value > 0 ? undefined : 'var(--border)' }}
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
