import { NextResponse, type NextRequest } from 'next/server'
import { verifyLineIdToken, signInOrBindWithLineProfile } from '@/lib/lineAuth'

export const dynamic = 'force-dynamic'

// LIFF 在 LINE App 內用 liff.getIDToken() 拿到的 id_token 送到這裡換 ProLink 的登入 session，
// 跟一般 LINE Login OAuth callback 走同一套帳號解析邏輯（見 lineAuth.ts），差別只在不用整頁跳轉。
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const idToken = body?.idToken

  if (!idToken || typeof idToken !== 'string') {
    return NextResponse.json({ ok: false, error: 'missing idToken' }, { status: 400 })
  }

  const profile = await verifyLineIdToken(idToken)
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'invalid idToken' }, { status: 401 })
  }

  const result = await signInOrBindWithLineProfile(profile)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    isNewAccount: result.mode === 'signed_in' && result.isNewAccount,
  })
}
