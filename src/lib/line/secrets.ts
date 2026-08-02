import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto'

// LINE 憑證的加解密。
//
// Channel access token 等同「可以用職人的名義發訊息給他所有好友」，
// 明文躺在資料庫裡，一次外洩就是他所有客人收到假訊息。
// 所以一律 AES-256-GCM 加密後才寫進去，金鑰只在環境變數裡。
//
// 選 GCM 而不是 CBC：GCM 自帶完整性驗證，被竄改的密文解不開而不是
// 解出一段垃圾。這種東西寧可壞掉也不要靜靜地錯。

const ALGORITHM = 'aes-256-gcm'
const VERSION = 'v1'

/** 同一把金鑰也給綁定記號用（linkToken.ts），少一個要顧的環境變數 */
export function encryptionKey(): Buffer {
  const raw = process.env.LINE_CREDENTIALS_KEY
  if (!raw) {
    throw new Error('缺少 LINE_CREDENTIALS_KEY，無法處理 LINE 憑證')
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('LINE_CREDENTIALS_KEY 必須是 32 bytes 的 base64（openssl rand -base64 32）')
  }
  return key
}

/** 沒設金鑰時要在畫面上講清楚，而不是等使用者按下儲存才爆掉 */
export function hasEncryptionKey(): boolean {
  try {
    encryptionKey()
    return true
  } catch {
    return false
  }
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64'), tag.toString('base64'), data.toString('base64')].join('.')
}

export function decryptSecret(payload: string): string {
  const [version, iv, tag, data] = payload.split('.')
  if (version !== VERSION || !iv || !tag || !data) {
    throw new Error('憑證格式不正確，可能是換過金鑰')
  }
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

/** 畫面上只顯示末四碼，讓職人確認自己貼的是哪一組，但看不回完整內容 */
export function maskTail(value: string, keep = 4): string {
  if (value.length <= keep) return '•'.repeat(8)
  return '•'.repeat(20) + value.slice(-keep)
}

/** 綁定碼：職人傳這串給自己的官方帳號，我們才知道他本人的 LINE 是哪個 */
export function newBindCode(): string {
  // 去掉容易看錯的 0/O/1/I，職人要用手打進 LINE
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(6)
  return 'BIND-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

/** 綁定碼比對用固定時間比較，不讓人用回應時間慢慢猜 */
export function codeMatches(input: string, expected: string | null): boolean {
  if (!expected) return false
  const a = Buffer.from(input.trim().toUpperCase())
  const b = Buffer.from(expected.trim().toUpperCase())
  return a.length === b.length && timingSafeEqual(a, b)
}
