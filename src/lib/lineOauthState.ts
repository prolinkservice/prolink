import crypto from 'crypto'

function getSecret() {
  return process.env.LINE_LOGIN_CHANNEL_SECRET!
}

export function signLineState(next: string) {
  const payload = { next, ts: Date.now() }
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', getSecret()).update(payloadStr).digest('base64url')
  return `${payloadStr}.${sig}`
}

const MAX_AGE_MS = 10 * 60 * 1000

export function verifyLineState(state: string): { next: string } | null {
  const [payloadStr, sig] = state.split('.')
  if (!payloadStr || !sig) return null

  const expectedSig = crypto.createHmac('sha256', getSecret()).update(payloadStr).digest('base64url')
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expectedSig)
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'))
    if (typeof payload.ts !== 'number' || Date.now() - payload.ts > MAX_AGE_MS) return null
    return { next: payload.next ?? '/' }
  } catch {
    return null
  }
}
