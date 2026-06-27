import { NextResponse, type NextRequest } from 'next/server'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next') ?? '/'
  const csrf = randomUUID()
  const state = Buffer.from(JSON.stringify({ csrf, next })).toString('base64url')

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const redirectUri = `${siteUrl}/auth/line/callback`

  const authorizeUrl = new URL('https://access.line.me/oauth2/v2.1/authorize')
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('client_id', process.env.LINE_LOGIN_CHANNEL_ID!)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('scope', 'profile openid')
  authorizeUrl.searchParams.set('bot_prompt', 'normal')

  const response = NextResponse.redirect(authorizeUrl.toString())
  response.cookies.set('line_csrf', csrf, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return response
}
