'use client'

import { useState } from 'react'
import {
  GROUP_LABEL,
  SLEEPING_DAYS,
  daysSince,
  groupsOf,
  matchesQuery,
  shortDate,
  vipThreshold,
  type CustomerGroup,
  type CustomerRow,
} from '@/lib/customers'
import { money } from '@/lib/bookings'
import { cn } from '@/lib/utils'
import { TextBox } from '@/components/FormBits'

// 客戶列表。草稿：docs/mockups/settings.html §03
//
// 分群一律在畫面上算，不寫進資料庫：
// 「沉睡 90 天」「VIP 前 20%」這種定義會改，存下來就會跟現實脫節。
// 客人數量到幾千筆都還在瀏覽器算得動的範圍。

const GROUPS: CustomerGroup[] = [
  'all',
  'new',
  'returning',
  'sleeping',
  'vip',
  'no_show',
  'blocked',
]

export function CustomerList({
  customers,
  timezone,
  loadError,
}: {
  customers: CustomerRow[]
  timezone: string
  loadError: string | null
}) {
  const [group, setGroup] = useState<CustomerGroup>('all')
  const [query, setQuery] = useState('')

  const vipFrom = vipThreshold(customers)
  const tagged = customers.map((c) => ({
    customer: c,
    groups: groupsOf(c, { vipFrom }),
  }))

  const counts = Object.fromEntries(
    GROUPS.map((g) => [g, tagged.filter((t) => t.groups.includes(g)).length])
  ) as Record<CustomerGroup, number>

  const shown = tagged
    .filter((t) => t.groups.includes(group))
    .filter((t) => matchesQuery(t.customer, query))

  return (
    <main className="pb-10">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-[21px] font-extrabold tracking-tight">客戶管理</h1>
        <p className="num text-[12.5px] text-ink-3">共 {customers.length} 位</p>
      </div>

      {loadError && (
        <p className="mb-4 rounded-sm bg-danger-bg px-4 py-3 text-[12.5px] font-bold text-danger">
          讀取客戶失敗：{loadError}
        </p>
      )}

      {customers.length === 0 ? (
        <div className="rounded-lg bg-card px-6 py-14 text-center shadow-soft">
          <div className="mx-auto mb-4 size-14 rounded-lg bg-accent" />
          <b className="block text-[15px] font-extrabold">還沒有客戶</b>
          <p className="mx-auto mt-1.5 max-w-[36ch] text-[13px] leading-relaxed text-ink-2">
            客人從你的預約連結約進來時會自動建立，你手動建預約也會。
            舊客人的批次匯入還在做。
          </p>
        </div>
      ) : (
        <>
          {/* 篩選鈕寫出各群人數：看到「沉睡客 23 人」自然會想去撈回來 */}
          <div className="mb-3 flex flex-wrap gap-2">
            {GROUPS.map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={cn(
                  'min-h-11 rounded-full px-4 text-[12.5px] font-extrabold transition',
                  g === group
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-sunk text-ink-2 hover:text-primary'
                )}
              >
                {GROUP_LABEL[g]}
                <span className="num ml-1.5 opacity-70">{counts[g]}</span>
              </button>
            ))}
          </div>

          <TextBox
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="打名字或手機號碼找人"
            className="mb-3"
          />

          <p className="mb-2 px-1 text-[11.5px] text-ink-3">
            {group === 'sleeping' && `${SLEEPING_DAYS} 天沒回來的客人。`}
            {group === 'vip' && '消費排前 20% 的客人。'}
            {group === 'new' && '只來過一次或還沒來過的客人。'}
            {group === 'blocked' && '線上約不到，你仍然可以手動幫他建預約。'}
            {shown.length !== counts[group] && `符合搜尋的有 ${shown.length} 位。`}
          </p>

          <ul className="flex flex-col gap-2">
            {shown.map(({ customer: c, groups }) => {
              const idle = daysSince(c.last_visit_at)
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-card px-4 py-3.5 shadow-soft"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-[11px_3px_11px_3px] bg-accent text-[14px] font-extrabold text-accent-foreground">
                    {c.name.slice(0, 1)}
                  </span>

                  <div className="min-w-[12ch] flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <b className="text-[14px] font-extrabold">{c.name}</b>
                      {groups.includes('vip') && <Tag tone="ok">VIP</Tag>}
                      {groups.includes('sleeping') && <Tag tone="warn">沉睡</Tag>}
                      {groups.includes('new') && <Tag tone="info">新客</Tag>}
                      {c.is_blocked && <Tag tone="danger">已封鎖</Tag>}
                      {c.is_exempt && <Tag tone="mute">豁免</Tag>}

                      {/* 通知發不發得出去，是這張列表上最實用的一格。
                          「未綁」＝他收不到任何自動通知，要自己打電話 */}
                      {c.line_blocked_at ? (
                        <Tag tone="danger">已封鎖我</Tag>
                      ) : c.line_user_id ? (
                        <Tag tone="ok">LINE 已綁</Tag>
                      ) : (
                        <Tag tone="mute">LINE 未綁</Tag>
                      )}
                    </div>
                    <p className="num mt-0.5 text-[11.5px] text-ink-3">
                      {c.phone ?? '沒有手機號碼'}
                    </p>
                  </div>

                  <div className="num flex shrink-0 items-center gap-x-5 text-right">
                    <Metric label="最後到訪">
                      {shortDate(c.last_visit_at, timezone)}
                      {idle !== null && idle >= SLEEPING_DAYS && (
                        <small className="ml-1 text-warn">{idle} 天</small>
                      )}
                    </Metric>
                    <Metric label="到店">{c.visit_count}</Metric>
                    <Metric label="放鳥" tone={Number(c.no_show_points) > 0}>
                      {Number(c.no_show_points) || 0}
                    </Metric>
                    <Metric label="累計消費">{money(c.total_spent)}</Metric>
                  </div>
                </li>
              )
            })}
          </ul>

          {shown.length === 0 && (
            <p className="rounded-lg bg-sunk px-5 py-8 text-center text-[13px] font-bold text-ink-3">
              這一群目前沒有人。
            </p>
          )}

          <p className="mt-4 px-1 text-[11.5px] leading-relaxed text-ink-3">
            「LINE 未綁」的客人收不到自動通知——他是從你的官網或自己存的網址進來預約的。
            把加好友連結傳給他，之後他從 LINE 那顆按鈕預約一次就會自動接上。
            <br />
            點客人看詳細資料、預約歷史與備註的頁面還在做；批次匯入舊客人也還沒好。
          </p>
        </>
      )}
    </main>
  )
}

function Tag({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'info' | 'danger' | 'mute'
  children: React.ReactNode
}) {
  const tones = {
    ok: 'bg-ok-bg text-ok',
    warn: 'bg-warn-bg text-warn',
    info: 'bg-info-bg text-info',
    danger: 'bg-danger-bg text-danger',
    mute: 'bg-sunk text-ink-3',
  }
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-extrabold', tones[tone])}>
      {children}
    </span>
  )
}

/** 數字一律等寬對齊，列表才會排成一直線（設計鐵則 3） */
function Metric({
  label,
  tone,
  children,
}: {
  label: string
  tone?: boolean
  children: React.ReactNode
}) {
  return (
    <span className="hidden sm:block">
      <small className="block text-[10px] font-bold text-ink-3">{label}</small>
      <b className={cn('text-[13px] font-extrabold', tone && 'text-danger')}>{children}</b>
    </span>
  )
}
