'use client'

import { useState } from 'react'

export interface UserRow {
  id: string
  name: string
  email: string
  role: string
  practitionerStatus: string | null
  gender: string | null
  age: number | null
  region: string | null
  createdAt: string
}

const ROLE_LABEL: Record<string, string> = {
  practitioner: '入駐老師',
  customer: '一般使用者',
  admin: '系統管理員',
}

const TABS: { key: string; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'practitioner', label: '入駐老師' },
  { key: 'customer', label: '一般使用者' },
  { key: 'admin', label: '系統管理員' },
]

const PRACTITIONER_STATUS_LABEL: Record<string, string> = {
  approved: '已上架',
  pending: '審核中',
  suspended: '已下架',
  rejected: '已退回',
}

export function UserListClient({ rows }: { rows: UserRow[] }) {
  const [tab, setTab] = useState('all')

  const counts: Record<string, number> = { all: rows.length, practitioner: 0, customer: 0, admin: 0 }
  for (const r of rows) counts[r.role] = (counts[r.role] ?? 0) + 1

  const filtered = tab === 'all' ? rows : rows.filter((r) => r.role === tab)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-1.5 rounded-full text-sm border whitespace-nowrap transition-colors ${
              tab === t.key ? 'bg-primary text-white border-primary' : 'border-input text-muted-foreground hover:border-primary'
            }`}
          >
            {t.label}（{counts[t.key] ?? 0}）
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">沒有符合條件的會員</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">姓名</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">角色</th>
                  <th className="px-4 py-3 font-medium">性別</th>
                  <th className="px-4 py-3 font-medium">年齡</th>
                  <th className="px-4 py-3 font-medium">地區</th>
                  <th className="px-4 py-3 font-medium">加入時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F8F7F5] transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{r.name}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-foreground">{ROLE_LABEL[r.role] ?? r.role}</span>
                      {r.practitionerStatus && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          ({PRACTITIONER_STATUS_LABEL[r.practitionerStatus] ?? r.practitionerStatus})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.gender ?? '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.age ?? '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.region ?? '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString('zh-TW')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
