'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DayData {
  date: string
  count: number
  payout: number
}

function fmtShortDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function DailyBarChart({ data }: { data: DayData[] }) {
  const [mode, setMode] = useState<'count' | 'payout'>('count')

  const maxVal = Math.max(1, ...data.map(d => (mode === 'count' ? d.count : d.payout)))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">每日趨勢</CardTitle>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setMode('count')}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              mode === 'count' ? 'bg-primary text-white border-primary' : 'border-input text-muted-foreground hover:border-primary'
            }`}
          >
            預約數
          </button>
          <button
            type="button"
            onClick={() => setMode('payout')}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              mode === 'payout' ? 'bg-primary text-white border-primary' : 'border-input text-muted-foreground hover:border-primary'
            }`}
          >
            實收金額
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {data.every(d => d.count === 0) ? (
          <p className="text-muted-foreground text-sm text-center py-10">這段期間還沒有已確認或已完成的預約</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1.5 h-40 min-w-[600px]">
              {data.map(d => {
                const value = mode === 'count' ? d.count : d.payout
                const heightPct = (value / maxVal) * 100
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6 text-[10px] bg-foreground text-white rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                      {mode === 'count' ? `${value} 筆` : `NT$${value.toLocaleString()}`}
                    </div>
                    <div
                      className="w-full bg-primary rounded-t-sm min-h-[2px] transition-all"
                      style={{ height: `${Math.max(heightPct, value > 0 ? 4 : 0)}%` }}
                    />
                    <p className="text-[9px] text-muted-foreground mt-1 rotate-0 whitespace-nowrap">{fmtShortDate(d.date)}</p>
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
