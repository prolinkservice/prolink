import { Card } from '@/components/FormBits'
import { cn } from '@/lib/utils'

// LINE 官方帳號後台要調的四個開關。
//
// 這張卡存在的唯一理由：不調的話客人會收到兩則歡迎訊息，
// 而職人不會知道為什麼——LINE 後台那則是 LINE 自己發的，
// 不經過我們，我們的用量看板上也看不到。每一個職人都會踩到這個坑。

const SWITCHES = [
  {
    name: '加入好友的歡迎訊息',
    state: 'off' as const,
    why: '我們自己發。只有我們發的那則帶得了綁定記號，LINE 後台那則發得再漂亮也認不出客人是誰。原本寫好的文字複製到下面「加好友的第一句話」貼上就好。',
  },
  {
    name: '自動回應訊息',
    state: 'off' as const,
    why: '不關的話，客人打「預約」會收到兩則回覆；客人隨便問一句話也會被罐頭訊息蓋掉。',
  },
  {
    name: 'Webhook',
    state: 'on' as const,
    why: '這是我們收得到客人訊息的唯一管道。關掉等於整套自動通知失效。',
  },
  {
    name: '聊天',
    state: 'on' as const,
    why: '客人問問題你才回得到。我們的系統對認不出的訊息刻意保持安靜，就是為了不擋你自己講話。',
  },
]

export function ConsoleChecklist() {
  return (
    <Card title="LINE 後台要調的四個開關" sub="設定一次就好">
      <div className="px-5 pt-1 pb-5">
        <p className="mb-3.5 text-[12.5px] leading-relaxed text-ink-3">
          到 LINE Official Account Manager →{' '}
          <b className="text-ink-2">設定 → 回應設定</b>，照下面調。
          不調的話最明顯的症狀是：<b className="text-ink-2">客人加好友會收到兩則歡迎訊息</b>。
        </p>

        <ul>
          {SWITCHES.map((s) => (
            <li
              key={s.name}
              className="flex gap-3 border-b border-hairline py-3 last:border-b-0"
            >
              {/* 狀態不能只靠顏色，一定要有文字（設計鐵則 4） */}
              <span
                className={cn(
                  'mt-px h-fit shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold',
                  s.state === 'on' ? 'bg-ok-bg text-ok' : 'bg-sunk text-ink-3'
                )}
              >
                {s.state === 'on' ? '開' : '關'}
              </span>
              <div className="min-w-[12ch] flex-1">
                <b className="text-[13.5px] font-extrabold">{s.name}</b>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-3">{s.why}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-3.5 rounded-sm bg-sunk px-4 py-3 text-[11.5px] leading-relaxed text-ink-3">
          上面那兩個「關」的功能是 LINE 自己發送的，不經過我們，
          所以<b className="text-ink-2">不會出現在下面的用量看板上</b>。
          它們算不算進你的免費額度，以 LINE 官方後台的用量頁為準。
        </p>
      </div>
    </Card>
  )
}
