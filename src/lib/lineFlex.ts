const TYPE_STYLE: Record<string, { color: string; emoji: string }> = {
  new_booking: { color: '#C96F35', emoji: '🔔' },
  new_review: { color: '#E0935D', emoji: '⭐' },
  verification_result: { color: '#3D2F26', emoji: '📋' },
  booking_confirmed: { color: '#2F9E44', emoji: '✅' },
  payment_received: { color: '#C96F35', emoji: '💰' },
  cancellation_requested: { color: '#D9480F', emoji: '⚠️' },
  cancellation_approved: { color: '#495057', emoji: '✅' },
  cancellation_rejected: { color: '#D9480F', emoji: '❌' },
  followup_message: { color: '#5C7CFA', emoji: '💬' },
}

const EMOJI_START = /^[\p{Emoji_Presentation}\p{Emoji}️]/u

// 按鈕連結改走 LIFF 網址，讓使用者在 LINE App 內點開時可以直接用 LIFF 靜默登入，不用再跳轉輸入密碼
function toLiffUrl(url: string): string {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID
  if (!liffId) return url
  try {
    const parsed = new URL(url)
    return `https://liff.line.me/${liffId}${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

function stripLeadingEmoji(line: string) {
  return line.replace(/^[\p{Emoji_Presentation}\p{Emoji}️]+\s*/u, '').trim()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildLineFlexBubble(type: string, title: string, lineText: string): { altText: string; contents: any } {
  const style = TYPE_STYLE[type] ?? { color: '#C96F35', emoji: '🔔' }
  const lines = lineText.split('\n')

  // 取出最後一個網址當按鈕連結，該行其餘文字留在內文（純「查看詳情：」這類標籤文字則整行拿掉，避免跟按鈕重複）
  let linkUrl: string | null = null
  const CTA_LABEL_ONLY = /^(查看|前往|點(此|擊)|了解)[^，。！\s]{0,8}$/
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(/(https?:\/\/\S+)/)
    if (match && match.index !== undefined) {
      linkUrl = match[1]
      const before = lines[i].slice(0, match.index).trim().replace(/[：:]$/, '').trim()
      const after = lines[i].slice(match.index + match[0].length).trim()
      const remaining = [before && !CTA_LABEL_ONLY.test(before) ? before : null, after || null]
        .filter(Boolean)
        .join(' ')
      if (remaining) lines[i] = remaining
      else lines.splice(i, 1)
      break
    }
  }

  while (lines.length && lines[0].trim() === '') lines.shift()
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()

  // 每個呼叫端的 lineText 慣例上第一行都是「emoji + 標語」，跟卡片 header 顯示的標題意思重複，內文不再顯示一次
  // 但如果整段訊息只有這一行（例如老師自訂的關懷訊息），這行本身就是唯一內容，不能刪掉
  if (lines.length > 1 && (EMOJI_START.test(lines[0]) || stripLeadingEmoji(lines[0]) === title.trim())) {
    lines.shift()
    while (lines.length && lines[0].trim() === '') lines.shift()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bodyContents: any[] = []
  let section: string[] = []
  const flushSection = () => {
    if (section.length === 0) return
    bodyContents.push({
      type: 'text',
      text: section.join('\n'),
      size: 'sm',
      color: '#5C4A3D',
      wrap: true,
    })
    section = []
  }
  for (const line of lines) {
    if (line.trim() === '') flushSection()
    else section.push(line)
  }
  flushSection()

  return {
    altText: `${style.emoji} ${title}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: style.color,
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: `${style.emoji} ${title}`,
            color: '#FFFFFF',
            weight: 'bold',
            size: 'md',
            wrap: true,
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        spacing: 'md',
        contents: bodyContents.length
          ? bodyContents
          : [{ type: 'text', text: title, size: 'sm', color: '#5C4A3D', wrap: true }],
      },
      ...(linkUrl
        ? {
            footer: {
              type: 'box',
              layout: 'vertical',
              paddingAll: '12px',
              contents: [
                {
                  type: 'button',
                  style: 'primary',
                  color: style.color,
                  height: 'sm',
                  action: { type: 'uri', label: '查看詳情', uri: toLiffUrl(linkUrl) },
                },
              ],
            },
          }
        : {}),
    },
  }
}
