import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { verifyLineState } from '@/lib/lineOauthState'

type LineVerifyResponse = {
  sub: string
  name?: string
  picture?: string
}

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
  const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: process.env.LINE_LOGIN_CHANNEL_ID!,
    }),
  })
  if (!verifyRes.ok) {
    console.error('[line-callback] id_token verify failed', verifyRes.status, await verifyRes.text())
    return NextResponse.redirect(`${siteUrl}/auth/error`)
  }
  const profile = (await verifyRes.json()) as LineVerifyResponse
  const lineUserId = profile.sub

  const supabase = await createServerSupabaseClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  if (currentUser) {
    // 已登入帳號：綁定 LINE 帳號（會員中心「綁定 LINE」用）
    const { error: bindError } = await supabase
      .from('profiles')
      .update({ line_user_id: lineUserId })
      .eq('id', currentUser.id)

    if (bindError) {
      // 23505 = unique 衝突，代表這個 LINE 帳號已經綁定在別的 ProLink 帳號上
      const message = bindError.code === '23505'
        ? '這個 LINE 帳號已經綁定在另一個 ProLink 帳號上，請先在那個帳號解除綁定再試一次'
        : '綁定 LINE 失敗，請再試一次'
      console.error('[line-callback] bind to existing user failed', bindError)
      return NextResponse.redirect(`${siteUrl}/auth/error?message=${encodeURIComponent(message)}`)
    }

    return NextResponse.redirect(`${siteUrl}${next}`)
  }

  // 未登入：用 LINE 帳號登入或建立新帳號
  const admin = createAdminSupabaseClient()

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('line_user_id', lineUserId)
    .maybeSingle()

  let targetEmail: string

  if (existingProfile) {
    const { data: authUserData } = await admin.auth.admin.getUserById(existingProfile.id)
    if (!authUserData.user?.email) {
      console.error('[line-callback] existing profile has no auth email', existingProfile.id)
      return NextResponse.redirect(`${siteUrl}/auth/error`)
    }
    targetEmail = authUserData.user.email
  } else {
    targetEmail = `line-${lineUserId}@line.prolink.invalid`
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: targetEmail,
      email_confirm: true,
      user_metadata: {
        full_name: profile.name ?? 'LINE 用戶',
        avatar_url: profile.picture ?? null,
      },
    })
    if (createError || !created.user) {
      console.error('[line-callback] createUser failed', createError)
      return NextResponse.redirect(`${siteUrl}/auth/error`)
    }
    await admin.from('profiles').update({ line_user_id: lineUserId }).eq('id', created.user.id)
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetEmail,
  })
  const tokenHash = linkData?.properties?.hashed_token
  if (linkError || !tokenHash) {
    console.error('[line-callback] generateLink failed', linkError)
    return NextResponse.redirect(`${siteUrl}/auth/error`)
  }

  const { error: otpError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  })
  if (otpError) {
    console.error('[line-callback] verifyOtp failed', otpError)
    return NextResponse.redirect(`${siteUrl}/auth/error`)
  }

  return NextResponse.redirect(`${siteUrl}${next}`)
}
