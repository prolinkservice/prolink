import { NextResponse, type NextRequest } from 'next/server'
import { verifyLineState } from '@/lib/lineOauthState'
import { verifyLineIdToken, signInOrBindWithLineProfile } from '@/lib/lineAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')

  if (!code || !state) {
    console.error('[line-callback] missing code or state', { code, state })
    return NextResponse.redirect(`${siteUrl}/auth/error`)
  }

  const verified = verifyLineState(state)
  if (!verified) {
    console.error('[line-callback] state signature invalid or expired')
    return NextResponse.redirect(`${siteUrl}/auth/error`)
  }
  const next = verified.next

  const redirectUri = `${siteUrl}/auth/line/callback`

  // 交換 access token + id_token
  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINE_LOGIN_CHANNEL_ID!,
      client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET!,
    }),
  })
  if (!tokenRes.ok) {
    console.error('[line-callback] token exchange failed', tokenRes.status, await tokenRes.text())
    return NextResponse.redirect(`${siteUrl}/auth/error`)
  }
  const tokenData = await tokenRes.json()
  const idToken = tokenData.id_token as string | undefined
  if (!idToken) {
    console.error('[line-callback] no id_token in token response', tokenData)
    return NextResponse.redirect(`${siteUrl}/auth/error`)
  }

  // 用 LINE 官方 verify endpoint 驗證 id_token 簽章與內容，取得 LINE 個人資料
  const profile = await verifyLineIdToken(idToken)
  if (!profile) {
    return NextResponse.redirect(`${siteUrl}/auth/error`)
  }

  const result = await signInOrBindWithLineProfile(profile)
  if (!result.ok) {
    return NextResponse.redirect(`${siteUrl}/auth/error?message=${encodeURIComponent(result.error)}`)
  }

  return NextResponse.redirect(`${siteUrl}/auth/line/added?next=${encodeURIComponent(next)}`)
}
