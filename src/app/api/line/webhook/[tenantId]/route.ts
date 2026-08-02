import { NextResponse, type NextRequest } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { isMuted, loadChannel, replyMessage, verifySignature } from '@/lib/line/channel'
import { codeMatches } from '@/lib/line/secrets'
import {
  buildCancelConfirm,
  buildWelcome,
  looksLikeBookingRequest,
  notifyCustomerCancelled,
} from '@/lib/line/notify'

// 每個租戶自己的 webhook（規格 §9.1）。
// 網址帶 tenantId，簽章用「那一家店的」channel secret 驗——
// 全站一組 secret 的話，A 店的憑證就能偽造 B 店的事件。
//
// LINE 要求快速回 200，否則會重送並在後台標記失敗。
// 所以這裡只做必要的事，不做慢的工作。
//
// 這支能回覆的一律用回覆而不是推播：回覆訊息不計入免費額度，
// 而職人的免費額度一個月只有 200 則（規格 §9.2）。

type LineEvent = {
  type: string
  replyToken?: string
  source?: { type: string; userId?: string; groupId?: string }
  message?: { type: string; text?: string }
  postback?: { data?: string }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params
  const rawBody = await request.text()

  const channel = await loadChannel(tenantId)
  // 還沒接上的店：安靜地回 200。LINE 那邊看到 4xx 會一直重送
  if (!channel) return NextResponse.json({ ok: true })

  if (!verifySignature(rawBody, request.headers.get('x-line-signature'), channel.channelSecret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()

  // 收到第一個通過驗證的事件，就代表職人把 webhook 貼對了。
  // 後台靠這個時間戳顯示「已驗證」，不用他自己回來按檢查
  await supabase
    .from('tenant_line_channels')
    .update({ webhook_verified_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)

  let events: LineEvent[] = []
  try {
    events = (JSON.parse(rawBody) as { events?: LineEvent[] }).events ?? []
  } catch {
    return NextResponse.json({ ok: true })
  }

  for (const event of events) {
    const userId = event.source?.userId
    if (!userId) continue

    // 群組訊息留給 Sprint 8，但來源類型現在就分開記（規格 §9.6 預留項目 1）
    if (event.source?.type !== 'user') continue

    const ctx = { tenantId, userId, accessToken: channel.accessToken, replyToken: event.replyToken }

    if (event.type === 'follow') {
      await handleFollow(ctx)
    } else if (event.type === 'unfollow') {
      await handleUnfollow(tenantId, userId)
    } else if (event.type === 'postback') {
      await handlePostback({ ...ctx, data: event.postback?.data ?? '' })
    } else if (event.type === 'message' && event.message?.type === 'text') {
      await handleText({
        ...ctx,
        text: event.message.text ?? '',
        bindCode: channel.operatorBindCode,
      })
    }
  }

  return NextResponse.json({ ok: true })
}

type Ctx = {
  tenantId: string
  userId: string
  accessToken: string
  replyToken?: string
}

/**
 * 客人加好友。
 *
 * LINE 在這裡只給我們一串代號——沒有姓名、沒有電話，所以還不知道他是誰。
 * 歡迎訊息裡那顆按鈕帶著加密記號，客人從它進來預約、填了手機的那一刻
 * 才真正綁起來（草稿 line-notifications.html §1）。
 */
async function handleFollow(ctx: Ctx) {
  const supabase = createAdminSupabaseClient()

  // 測試模式：真實客人加好友時我們完全不出聲，
  // 讓 LINE 後台自己那則歡迎訊息照常運作
  if (await isMuted(ctx.tenantId, ctx.userId)) return

  // 之前封鎖過又回來的舊客：把封鎖記號清掉，他又收得到通知了
  await supabase
    .from('customers')
    .update({ line_blocked_at: null })
    .eq('tenant_id', ctx.tenantId)
    .eq('line_user_id', ctx.userId)

  const messages = await buildWelcome({
    tenantId: ctx.tenantId,
    lineUserId: ctx.userId,
    withGreeting: true,
  })
  if (!messages) return
  await replyMessage(ctx.accessToken, ctx.replyToken, messages)
}

/**
 * 客人封鎖或刪除了官方帳號。記下來，免得職人以為客人收到了通知。
 * 不刪 line_user_id——他可能只是暫時封鎖，加回來就恢復。
 */
async function handleUnfollow(tenantId: string, userId: string) {
  const supabase = createAdminSupabaseClient()
  await supabase
    .from('customers')
    .update({ line_blocked_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('line_user_id', userId)
}

/**
 * 客人按了卡片上的按鈕：確認預約 / 我要取消。
 *
 * 兩支資料庫函式都用 LINE 代號驗身份而不是登入身分——
 * 客人從頭到尾沒有帳號，這裡也沒有 session。
 */
async function handlePostback(ctx: Ctx & { data: string }) {
  const params = new URLSearchParams(ctx.data)
  const action = params.get('a')
  const bookingId = params.get('b')
  const known = ['confirm', 'cancel', 'cancel_yes', 'cancel_no']
  if (!bookingId || !action || !known.includes(action)) return

  // 測試模式：真實客人手上可能還留著開測試之前發出去的卡片，
  // 按下去不該真的動到他的預約
  if (await isMuted(ctx.tenantId, ctx.userId)) return

  const supabase = createAdminSupabaseClient()

  // 按下取消先問一次「確定嗎」。卡片會一直留在對話裡，
  // 客人幾天後回頭捲訊息很容易誤觸，而取消是不可逆的——
  // 時段當場釋出，可能立刻被別人約走。這一則走回覆，不計額度
  if (action === 'cancel') {
    const confirm = await buildCancelConfirm(bookingId, ctx.userId)
    await replyMessage(
      ctx.accessToken,
      ctx.replyToken,
      confirm
        ? [confirm]
        : [{ type: 'text', text: '這筆預約已經不能取消了，麻煩直接跟我說一聲。' }]
    )
    return
  }

  if (action === 'cancel_no') {
    await replyMessage(ctx.accessToken, ctx.replyToken, [
      { type: 'text', text: '好的，預約保留著，到時候見 👍' },
    ])
    return
  }

  if (action === 'confirm') {
    const { error } = await supabase.rpc('confirm_booking_by_line', {
      p_booking_id: bookingId,
      p_line_user_id: ctx.userId,
    })
    if (error) {
      await replyMessage(ctx.accessToken, ctx.replyToken, [
        { type: 'text', text: friendlyError(error.code, '這筆預約已經不能確認了，有問題直接跟我說。') },
      ])
      return
    }
    await replyMessage(ctx.accessToken, ctx.replyToken, [
      { type: 'text', text: '收到，到時候見 👍\n當天前一晚會再提醒你一次。' },
    ])
    return
  }

  const { data, error } = await supabase.rpc('cancel_booking', {
    p_booking_id: bookingId,
    p_actor: 'customer',
    p_reason: null,
    p_line_user_id: ctx.userId,
  })

  if (error) {
    await replyMessage(ctx.accessToken, ctx.replyToken, [
      { type: 'text', text: friendlyError(error.code, '這筆預約已經取消不了了，麻煩直接跟我說一聲。') },
    ])
    return
  }

  const row = (Array.isArray(data) ? data[0] : data) as { late?: boolean } | null
  await replyMessage(ctx.accessToken, ctx.replyToken, [
    { type: 'text', text: '已經幫你取消了，時段也釋出了。想改約隨時跟我說 🙏' },
  ])

  // 職人要知道有人退掉，那個時段現在空出來了
  await notifyCustomerCancelled(bookingId, Boolean(row?.late))
}

/**
 * 目前只認綁定碼。職人用自己的 LINE 把碼傳給官方帳號，
 * 我們才知道「他本人的 LINE 是哪一個」——之後測試訊息、
 * 一句話建立預約都要用到。
 *
 * 不用「第一個傳訊息的人就是老闆」，那等於誰先傳誰是老闆。
 */
async function handleText(input: Ctx & { text: string; bindCode: string | null }) {
  if (!codeMatches(input.text, input.bindCode)) {
    await handleKeyword(input)
    return
  }

  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.from('tenant_line_operators').upsert(
    {
      tenant_id: input.tenantId,
      line_user_id: input.userId,
      role: 'admin',
    },
    { onConflict: 'tenant_id,line_user_id' }
  )

  if (error) {
    console.error('[line] 綁定操作者失敗', { tenantId: input.tenantId, message: error.message })
    return
  }

  // 綁定碼用過就作廢，避免被截圖或轉傳之後有人拿去綁自己
  await supabase
    .from('tenant_line_channels')
    .update({ operator_bind_code: null })
    .eq('tenant_id', input.tenantId)

  await replyMessage(input.accessToken, input.replyToken, [
    { type: 'text', text: '綁定完成，之後的通知會從這個帳號發給客人。' },
  ])
}

/**
 * 客人自己打「預約」「我要預約」時，回同一張「立即預約」卡片。
 *
 * 這是綁定漏洞最划算的補法：早就加了好友、歡迎訊息卻早已滑不見的舊客人，
 * 打兩個字就拿得到帶記號的按鈕。回覆訊息不計免費額度，等於零成本。
 *
 * 兩件刻意不做的事：
 *   · **對不上的訊息一律不回。** 客人傳「你好」或問「腰痛適合哪一種」時
 *     系統保持安靜，讓職人自己回。罐頭訊息會蓋掉他想講的話，
 *     也會讓客人以為在跟機器人講話
 *   · **職人自己打「預約」不觸發。** 那個位置留給之後的「一句話建立預約」
 */
async function handleKeyword(ctx: Ctx & { text: string }) {
  if (!looksLikeBookingRequest(ctx.text)) return

  // 測試模式：這條路本來就只走給非操作者，所以整條關掉
  if (await isMuted(ctx.tenantId, ctx.userId)) return

  const supabase = createAdminSupabaseClient()
  const { data: operator } = await supabase
    .from('tenant_line_operators')
    .select('id')
    .eq('tenant_id', ctx.tenantId)
    .eq('line_user_id', ctx.userId)
    .maybeSingle()
  if (operator) return

  const messages = await buildWelcome({
    tenantId: ctx.tenantId,
    lineUserId: ctx.userId,
    withGreeting: false,
  })
  if (!messages) return
  await replyMessage(ctx.accessToken, ctx.replyToken, messages)
}

/**
 * 客人看到的錯誤訊息不能是系統語言。
 * P0403 是「這不是你的預約」——這種情況多半是轉傳的卡片，講白一點比較好。
 */
function friendlyError(code: string | undefined, fallback: string): string {
  if (code === 'P0403') return '這筆預約不是用這個 LINE 帳號約的，麻煩直接跟我說一聲。'
  if (code === 'P0404') return '找不到這筆預約，麻煩直接跟我說一聲。'
  return fallback
}
