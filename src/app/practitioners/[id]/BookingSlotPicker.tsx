'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock, CheckCircle2 } from 'lucide-react'

type Service = { id: string; name: string; duration_minutes: number; price: number }
type Slot = { id: string; start_time: string; end_time: string; is_booked: boolean }

const WEEKDAY_LABEL = ['日', '一', '二', '三', '四', '五', '六']

function toTaipeiTime(iso: string) {
  const d = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export function BookingSlotPicker({
  practitionerId,
  services,
  groupedSlots,
  isLoggedIn,
}: {
  practitionerId: string
  services: Service[]
  groupedSlots: Record<string, Slot[]>
  isLoggedIn: boolean
}) {
  const [selectedServiceId, setSelectedServiceId] = useState(services[0]?.id ?? '')

  const slotHref = (slotId: string) => isLoggedIn
    ? `/booking?slotId=${slotId}&practitionerId=${practitionerId}&serviceId=${selectedServiceId}`
    : `/auth?next=${encodeURIComponent(`/practitioners/${practitionerId}`)}`

  return (
    <div className="flex flex-col gap-5">
      {/* 第一步：選擇服務項目 */}
      {services.length > 0 && (
        <div>
          <h2 className="font-bold text-lg mb-3">1. 選擇服務項目</h2>
          <div className="flex flex-col gap-2">
            {services.map((s) => {
              const selected = s.id === selectedServiceId
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedServiceId(s.id)}
                  className={`text-left rounded-xl border-2 transition-all duration-150 active:scale-[0.98] shadow-sm ${
                    selected ? 'border-primary bg-primary/5' : 'border-transparent bg-white'
                  }`}
                >
                  <div className="px-4 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <CheckCircle2 className={`w-4 h-4 text-primary ${selected ? 'opacity-100' : 'opacity-30'}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{s.name}</p>
                        <div className="flex items-center gap-1 mt-0.5 text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs">{s.duration_minutes} 分鐘</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-primary font-bold text-base">NT${s.price}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 第二步：選擇時段 */}
      <div>
        <h2 className="font-bold text-lg mb-3">{services.length > 0 ? '2. 選擇時段' : '可預約時段'}</h2>
        {Object.keys(groupedSlots).length === 0 ? (
          <p className="text-muted-foreground text-base">目前沒有可預約時段</p>
        ) : (
          <div className="flex flex-col gap-5">
            {Object.entries(groupedSlots).map(([date, dateSlots]) => {
              const [y, m, day] = date.split('-')
              const wd = WEEKDAY_LABEL[new Date(Date.UTC(Number(y), Number(m) - 1, Number(day))).getUTCDay()]
              return (
                <div key={date}>
                  <p className="text-sm font-bold mb-2">{m}/{day}（{wd}）</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {dateSlots.map((slot) => (
                      slot.is_booked ? (
                        <div key={slot.id} className="rounded-lg border border-border bg-muted/40 px-1.5 py-2 text-center opacity-40 cursor-not-allowed">
                          <p className="text-sm font-medium text-muted-foreground">{toTaipeiTime(slot.start_time)}</p>
                        </div>
                      ) : (
                        <Link key={slot.id} href={slotHref(slot.id)}>
                          <div className="rounded-lg border border-primary/30 bg-primary/5 px-1.5 py-2 text-center hover:bg-primary hover:border-primary active:scale-95 transition-all duration-150 cursor-pointer group">
                            <p className="text-sm font-bold text-primary group-hover:text-white">{toTaipeiTime(slot.start_time)}</p>
                          </div>
                        </Link>
                      )
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
