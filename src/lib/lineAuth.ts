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

// 用來救援「auth.users 已經有這個信箱，但沒有任何 profile 指向它」的情況（例如帳號的 line_user_id 曾被人工清空過），
// 否則下面 createUser 會撞信箱重複而整個登入失敗，因為信箱是用 line_user_id 算出來的固定值
async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
    }
  )
  if (!res.ok) {
    console.error('[lineAuth] findAuthUserIdByEmail failed', res.status, await res.text())
    return null
  }
  const data = await res.json()
  const users = Array.isArray(data) ? data : data.users
  return users?.[0]?.id ?? null
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
      // email_exists：這組信箱已經有 auth.users 帳號，但沒有 profile 指向它（例如曾被人工解除 LINE 綁定），
      // 直接把 LINE 重新接回那個既有帳號，而不是當成建立失敗
      const existingUserId = createError?.code === 'email_exists' ? await findAuthUserIdByEmail(targetEmail) : null
      if (!existingUserId) {
        console.error('[lineAuth] createUser failed', createError)
        return { ok: false, error: '建立帳號失敗，請再試一次' }
      }
      isNewAccount = false
      const { error: relinkError } = await admin.from('profiles').update({ line_user_id: lineUserId }).eq('id', existingUserId)
      if (relinkError) {
        console.error('[lineAuth] relink existing email-matched user failed', relinkError)
        return { ok: false, error: '登入失敗，請再試一次' }
      }
    } else {
      await admin.from('profiles').update({ line_user_id: lineUserId }).eq('id', created.user.id)
    }
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
