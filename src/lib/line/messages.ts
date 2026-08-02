import type { LineMessage } from './channel'

// LINE 訊息的長相。草稿：docs/mockups/line-notifications.html §2、§3
//
// 純函式、不碰資料庫，改文案不用重跑整條流程。
// 顏色沿用全站的暖陶色票——客人在 LINE 裡看到的卡片，跟他點進去的預約頁是同一套。

const CLAY = '#a34e33'
const OLIVE = '#6b7a45'
const BRICK = '#a63e33'
const OCHRE = '#a9762b'

type Row = { label: string; value: string; sub?: string }

/**
 * 卡片一律長一樣：色帶標題 + 幾行資料 + 最多兩顆按鈕。
 * 統一長相是為了讓客人一眼認出「這是預約的訊息」而不是廣告。
 */
function bubble(input: {
  title: string
  color: string
  lead?: string
  rows?: Row[]
  footNote?: string
  buttons?: { label: string; action: unknown; tone?: 'primary' | 'quiet' }[]
}) {
  const body: unknown[] = []

  if (input.lead) {
    body.push({ type: 'text', text: input.lead, size: 'sm', color: '#574a42', wrap: true })
  }

  for (const row of input.rows ?? []) {
    body.push({
      type: 'box',
      layout: 'baseline',
      spacing: 'md',
      contents: [
        { type: 'text', text: row.label, size: 'xs', color: '#b0a093', flex: 2 },
        {
          type: 'text',
          text: row.sub ? `${row.value}\n${row.sub}` : row.value,
          size: 'sm',
          color: '#2a211c',
          weight: 'bold',
          wrap: true,
          flex: 5,
        },
      ],
    })
  }

  const buttons = (input.buttons ?? []).map((b) => ({
    type: 'button',
    style: b.tone === 'quiet' ? 'secondary' : 'primary',
    color: b.tone === 'quiet' ? '#efe7dc' : input.color,
    height: 'sm',
    action: b.action,
  }))

  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: input.color,
      paddingAll: '16px',
      contents: [
        { type: 'text', text: input.title, color: '#ffffff', weight: 'bold', size: 'md', wrap: true },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'sm',
      contents: body.length ? body : [{ type: 'text', text: ' ', size: 'xs' }],
    },
    ...(buttons.length || input.footNote
      ? {
          footer: {
            type: 'box',
            layout: 'vertical',
            paddingAll: '12px',
            spacing: 'sm',
            contents: [
              ...buttons,
              ...(input.footNote
                ? [
                    {
                      type: 'text',
                      text: input.footNote,
                      size: 'xxs',
                      color: '#857466',
                      align: 'center',
                      wrap: true,
                    },
                  ]
                : []),
            ],
          },
        }
      : {}),
  }
}

export const DEFAULT_WELCOME = (tenantName: string) =>
  `謝謝你加入${tenantName} 🙌\n\n有需要預約的話，直接按下面的按鈕就可以看時段，不用打電話。\n\n有任何問題也可以在這裡直接問我。`

/**
 * 「立即預約」卡片。那顆按鈕帶著綁定記號，客人照常預約就把 LINE 接上了。
 *
 * 兩個時機用同一張：加好友的時候，以及客人自己打「預約」的時候。
 * 同一張卡片重複出現是刻意的——客人第二次看到就知道「按這裡就對了」。
 */
export function bookingCardMessage(input: {
  tenantName: string
  bookUrl: string
  openDays: string | null
  locations: string | null
  phone: string | null
}): LineMessage {
  const rows: Row[] = []
  if (input.openDays) rows.push({ label: '營業', value: input.openDays })
  if (input.locations) rows.push({ label: '地點', value: input.locations })
  if (input.phone) rows.push({ label: '電話', value: input.phone })

  return {
    type: 'flex',
    altText: `${input.tenantName}．線上預約`,
    contents: bubble({
      title: '🗓 立即預約',
      color: CLAY,
      rows,
      buttons: [
        { label: '查看可預約時段', action: { type: 'uri', label: '查看可預約時段', uri: input.bookUrl } },
      ],
    }),
  }
}

export type BookingBrief = {
  bookingId: string
  serviceName: string
  when: string
  locationName: string | null
  locationAddress: string | null
  serviceAddress: string | null
  price: string
}

function placeRow(b: BookingBrief): Row | null {
  const value = b.locationName ?? b.serviceAddress
  if (!value) return null
  return { label: '地點', value, sub: b.locationName ? (b.locationAddress ?? undefined) : undefined }
}

/**
 * 送出預約後請客人按一次確認（規格 §4.3）。
 * 放鳥的第一名原因是「忘了」，按過確認的人記得住。
 */
export function confirmRequestMessage(input: {
  booking: BookingBrief
  tenantName: string
}): LineMessage {
  const b = input.booking
  return {
    type: 'flex',
    altText: `請確認你在${input.tenantName}的預約：${b.when}`,
    contents: bubble({
      title: '⏳ 請確認你的預約',
      color: OCHRE,
      rows: [
        { label: '項目', value: b.serviceName },
        { label: '時間', value: b.when },
        ...(placeRow(b) ? [placeRow(b)!] : []),
        { label: '金額', value: b.price },
      ],
      buttons: [
        {
          label: '確認預約',
          tone: 'primary',
          action: { type: 'postback', label: '確認預約', data: `a=confirm&b=${b.bookingId}` },
        },
        {
          label: '我要取消',
          tone: 'quiet',
          action: { type: 'postback', label: '我要取消', data: `a=cancel&b=${b.bookingId}` },
        },
      ],
      footNote: '24 小時內沒有確認，時段會自動釋出',
    }),
  }
}

/**
 * 預約直接成立時發給客人。
 *
 * 什麼時候走這條而不是請他確認：開始時間在 24 小時內的預約。
 * 那種單要求確認會出事——「24 小時未確認自動釋出」的時間點會晚於預約本身，
 * 那筆就永遠卡在待確認。明天就要來的預約本來也不會忘記。
 *
 * 但反悔的路要留著，所以按鈕是「我無法前往」（規格 §6.5：取消愈好按，放鳥愈少）。
 */
export function bookingConfirmedMessage(input: {
  booking: BookingBrief
  tenantName: string
}): LineMessage {
  const b = input.booking
  return {
    type: 'flex',
    altText: `${input.tenantName}：${b.when} 的預約已成立`,
    contents: bubble({
      title: '✅ 預約成立',
      color: OLIVE,
      rows: [
        { label: '項目', value: b.serviceName },
        { label: '時間', value: b.when },
        ...(placeRow(b) ? [placeRow(b)!] : []),
        { label: '金額', value: b.price },
      ],
      buttons: [
        {
          label: '我無法前往',
          tone: 'quiet',
          action: { type: 'postback', label: '我無法前往', data: `a=cancel&b=${b.bookingId}` },
        },
      ],
      footNote: '有事無法前往請盡早按上面的按鈕，不用不好意思',
    }),
  }
}

/** 職人取消時發給客人。刻意不寫原因——他填的可能是內部備註（2026-08-02 定案） */
export function cancelledForCustomerMessage(input: {
  booking: BookingBrief
  tenantName: string
  bookUrl: string
}): LineMessage {
  const b = input.booking
  return {
    type: 'flex',
    altText: `${input.tenantName}：${b.when} 的預約已取消`,
    contents: bubble({
      title: '✕ 預約已取消',
      color: BRICK,
      lead: '不好意思，這筆預約已經取消。造成不便請見諒，想改約隨時跟我說。',
      rows: [
        { label: '項目', value: b.serviceName },
        { label: '原時間', value: b.when },
        ...(placeRow(b) ? [placeRow(b)!] : []),
      ],
      buttons: [{ label: '重新預約', action: { type: 'uri', label: '重新預約', uri: input.bookUrl } }],
    }),
  }
}

/**
 * 按下取消之後先問一次「確定嗎」。
 *
 * 規格 §6.5 說「取消愈好按，放鳥愈少」，但那指的是**找得到**取消的入口，
 * 不是手滑就沒了。卡片會一直留在對話裡，客人幾天後回頭捲訊息很容易誤觸，
 * 而取消是不可逆的——時段當場釋出，可能立刻被別人約走。
 *
 * 這一則走回覆訊息，不計免費額度，所以問這一句是零成本。
 */
export function cancelConfirmMessage(input: {
  booking: BookingBrief
  late: boolean
  hoursLeft: number
}): LineMessage {
  const b = input.booking
  return {
    type: 'flex',
    altText: `確定要取消 ${b.when} 的預約嗎？`,
    contents: bubble({
      title: '確定要取消嗎？',
      color: BRICK,
      lead: '取消之後這個時段會馬上開放給其他人，可能沒辦法再約回來。',
      rows: [
        { label: '項目', value: b.serviceName },
        { label: '時間', value: b.when },
      ],
      buttons: [
        {
          label: '確定取消',
          tone: 'primary',
          action: { type: 'postback', label: '確定取消', data: `a=cancel_yes&b=${b.bookingId}` },
        },
        {
          label: '不取消，我會到',
          tone: 'quiet',
          action: { type: 'postback', label: '不取消', data: `a=cancel_no&b=${b.bookingId}` },
        },
      ],
      footNote: input.late
        ? `距離開始剩 ${input.hoursLeft} 小時，這時候取消會計 0.5 點`
        : undefined,
    }),
  }
}

/** 超過期限沒確認，時段釋出。文案不能責備客人——他可能只是沒看到訊息 */
export function expiredForCustomerMessage(input: {
  booking: BookingBrief
  tenantName: string
  bookUrl: string
}): LineMessage {
  const b = input.booking
  return {
    type: 'flex',
    altText: `${input.tenantName}：${b.when} 的時段已釋出`,
    contents: bubble({
      title: '⏱ 時段已經釋出',
      color: OCHRE,
      lead: '這筆預約超過確認時間，時段已經開放給其他人了。還想來的話再約一次就好，或直接跟我說。',
      rows: [
        { label: '項目', value: b.serviceName },
        { label: '原時間', value: b.when },
      ],
      buttons: [{ label: '重新預約', action: { type: 'uri', label: '重新預約', uri: input.bookUrl } }],
    }),
  }
}

/** 有新預約時發給職人自己。可以在設定裡關掉，關掉可省下約四分之一的額度 */
export function newBookingForOperatorMessage(input: {
  booking: BookingBrief
  customerName: string
  customerPhone: string | null
  visitCount: number
  dashboardUrl: string
  needsConfirm: boolean
}): LineMessage {
  const b = input.booking
  return {
    type: 'flex',
    altText: `新預約：${input.customerName} ${b.when}`,
    contents: bubble({
      title: '🔔 新預約',
      color: OLIVE,
      rows: [
        {
          label: '客人',
          value: `${input.customerName}${input.visitCount > 0 ? `　第 ${input.visitCount + 1} 次` : '　新客'}`,
        },
        ...(input.customerPhone ? [{ label: '電話', value: input.customerPhone }] : []),
        { label: '項目', value: b.serviceName },
        { label: '時間', value: b.when },
        ...(placeRow(b) ? [placeRow(b)!] : []),
      ],
      buttons: [{ label: '打開後台看', action: { type: 'uri', label: '打開後台看', uri: input.dashboardUrl } }],
      footNote: input.needsConfirm ? '已經請客人在 LINE 確認，確認後這筆會變成已確認' : undefined,
    }),
  }
}

/** 客人自己按了取消，發給職人。要講清楚時段已經放回去了 */
export function customerCancelledForOperatorMessage(input: {
  booking: BookingBrief
  customerName: string
  late: boolean
  hoursLeft: number
}): LineMessage {
  const b = input.booking
  return {
    type: 'flex',
    altText: `${input.customerName} 取消了 ${b.when} 的預約`,
    contents: bubble({
      title: '⚠️ 客人取消了',
      color: BRICK,
      rows: [
        { label: '客人', value: input.customerName },
        { label: '項目', value: b.serviceName },
        { label: '原時間', value: b.when },
        {
          label: '距離',
          value: input.late
            ? `剩 ${input.hoursLeft} 小時，算臨時取消`
            : `剩 ${input.hoursLeft} 小時`,
        },
      ],
      footNote: input.late
        ? '時段已經釋出，其他客人約得到了。已計 0.5 點'
        : '時段已經釋出，其他客人約得到了',
    }),
  }
}
