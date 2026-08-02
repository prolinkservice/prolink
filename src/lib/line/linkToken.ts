import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { encryptionKey } from './secrets'

// 加好友之後那顆「立即預約」按鈕上的記號（規格 §9.5 的前置）。
//
// LINE 的 follow 事件只給我們一串代號，沒有姓名也沒有電話，
// 所以系統不知道加好友的是哪一位客人。這個記號的用途是把兩邊接起來：
// 客人從按鈕進來、照常填手機送出，那一刻我們同時知道手機與 LINE 代號。
//
// 為什麼要加密而不是直接把代號放網址上：
//   ① 代號等同「可以用職人的名義發訊息給這個人」的收件地址，
//      放在明碼網址上會進瀏覽器紀錄、Referer、被人轉貼
//   ② 加密後別人無法自己編一個記號去冒充別的客人
//
// 綁的是「哪一家店的哪個代號」，A 店的記號拿到 B 店解不開也不會生效。

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

/** 名片、書籤裡的舊連結不該永久有效。30 天夠客人慢慢決定要不要約 */
const TTL_MS = 30 * 24 * 60 * 60 * 1000

type Payload = { t: string; u: string; e: number }

/**
 * 發一個記號。丟不出來（沒設金鑰）時回 null——
 * 少一個記號只是綁不到，不該讓歡迎訊息整個發不出去。
 */
export function issueLinkToken(input: {
  tenantId: string
  lineUserId: string
  now?: number
}): string | null {
  try {
    const payload: Payload = {
      t: input.tenantId,
      u: input.lineUserId,
      e: Math.floor(((input.now ?? Date.now()) + TTL_MS) / 1000),
    }
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv)
    const data = Buffer.concat([
      cipher.update(JSON.stringify(payload), 'utf8'),
      cipher.final(),
    ])
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url')
  } catch (error) {
    console.error('[line] 綁定記號發不出來', error)
    return null
  }
}

/**
 * 讀回記號裡的 LINE 代號。任何一點不對（過期、換過金鑰、被改過、
 * 不是這家店的）一律回 null，呼叫端就當作沒有綁定資訊照常建立預約。
 */
export function readLinkToken(
  token: string | null | undefined,
  expectedTenantId: string,
  now = Date.now()
): string | null {
  if (!token) return null
  try {
    const raw = Buffer.from(token, 'base64url')
    if (raw.length <= IV_BYTES + TAG_BYTES) return null

    const decipher = createDecipheriv(
      ALGORITHM,
      encryptionKey(),
      raw.subarray(0, IV_BYTES)
    )
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES))
    const plain = Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8')

    const payload = JSON.parse(plain) as Partial<Payload>
    if (payload.t !== expectedTenantId) return null
    if (!payload.u || typeof payload.u !== 'string') return null
    if (!payload.e || payload.e * 1000 < now) return null
    return payload.u
  } catch {
    // 被改過的記號會在這裡解不開。這是正常情況，不值得寫 log
    return null
  }
}
