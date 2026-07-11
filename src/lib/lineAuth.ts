import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

type LineVerifyResponse = {
  sub: string
  name?: string
  picture?: string
}

export async function verifyLineIdToken(idToken: string): Promise<LineVerifyResponse | null> {
  const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: process.env.LINE_LOGIN_CHANNEL_ID!,
    }),
  })
  if (!verifyRes.ok) {
    console.error('[lineAuth] id_token verify failed', verifyRes.status, await verifyRes.text())
    return null
  }
  return (await verifyRes.json()) as LineVerifyResponse
}

export type LineSignInResult =
  | { ok: true; mode: 'bound' }
  | { ok: true; mode: 'signed_in'; isNewAccount: boolean }
  | { ok: false; error: string }

// 已登入時綁定 LINE 帳號到現有帳號；未登入時用 LINE 帳號登入既有帳號或建立新帳號。
// LINE Login OAuth callback 跟 LIFF 靜默登入共用同一套帳號解析邏輯，只是取得 id_token 的管道不同。
export async function signInOrBindWithLineProfile(profile: LineVerifyResponse): Promise<LineSignInResult> {
  const lineUserId = profile.sub
  const supabase = await createServerSupabaseClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  if (currentUser) {
    const { error: bindError } = await supabase
      .from('profiles')
      .update({ line_user_id: lineUserId })
      .eq('id', currentUser.id)

    if (bindError) {
      // 23505 = unique 衝突，代表這個 LINE 帳號已經綁定在別的 ProLink 帳號上
      const message = bindError.code === '23505'
        ? '這個 LINE 帳號已經綁定在另一個 ProLink 帳號上，請先在那個帳號解除綁定再試一次'
        : '綁定 LINE 失敗，請再試一次'
      console.error('[lineAuth] bind to existing user failed', bindError)
      return { ok: false, error: message }
    }
    return { ok: true, mode: 'bound' }
  }

  const admin = createAdminSupabaseClient()
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('line_user_id', lineUserId)
    .maybeSingle()

  let targetEmail: string
  let isNewAccount = false

  if (existingProfile) {
    const { data: authUserData } = await admin.auth.admin.getUserById(existingProfile.id)
    if (!authUserData.user?.email) {
      console.error('[lineAuth] existing profile has no auth email', existingProfile.id)
      return { ok: false, error: '登入失敗，請再試一次' }
    }
    targetEmail = authUserData.user.email
  } else {
    isNewAccount = true
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
      console.error('[lineAuth] createUser failed', createError)
      return { ok: false, error: '建立帳號失敗，請再試一次' }
    }
    await admin.from('profiles').update({ line_user_id: lineUserId }).eq('id', created.user.id)
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetEmail,
  })
  const tokenHash = linkData?.properties?.hashed_token
  if (linkError || !tokenHash) {
    console.error('[lineAuth] generateLink failed', linkError)
    return { ok: false, error: '登入失敗，請再試一次' }
  }

  const { error: otpError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  })
  if (otpError) {
    console.error('[lineAuth] verifyOtp failed', otpError)
    return { ok: false, error: '登入失敗，請再試一次' }
  }

  return { ok: true, mode: 'signed_in', isNewAccount }
}
