'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, ErrorNote, Field, PrimaryButton, QuietButton, TextBox } from '@/components/FormBits'
import { CopyLinkButton } from '../CopyLinkButton'
import {
  disconnectChannel,
  recheckChannel,
  regenerateBindCode,
  saveChannel,
  sendTestMessage,
} from './channel-actions'

// 接上自己的 LINE 官方帳號。草稿：docs/mockups/line-setup.html §02
//
// 憑證加密後才進資料庫，畫面上永遠只看得到末四碼——
// access token 等同「可以用你的名義發訊息給所有好友」。

export type ChannelState = {
  connected: boolean
  channelId: string | null
  secretTail: string | null
  tokenTail: string | null
  botBasicId: string | null
  botDisplayName: string | null
  webhookVerifiedAt: string | null
  operatorBound: boolean
  bindCode: string | null
  status: string | null
  /** 讀取憑證時就出錯了。這種情況不能顯示成「還沒接上」 */
  loadError: string | null
}

export function ChannelCard({
  state,
  webhookUrl,
  hasKey,
}: {
  state: ChannelState
  webhookUrl: string
  hasKey: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(!state.connected)
  const [channelId, setChannelId] = useState(state.channelId ?? '')
  const [channelSecret, setChannelSecret] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run(work: () => Promise<ActionLike>) {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const res = await work()
      if (!res.ok) return setError(res.error)
      setMessage(res.message ?? null)
      setChannelSecret('')
      setAccessToken('')
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <Card
      title="LINE 官方帳號"
      sub={state.connected ? undefined : '還沒接上'}
      right={
        state.connected && (
          <span className="rounded-full bg-ok-bg px-3 py-1 text-[11px] font-extrabold text-ok">
            ● 已連線
          </span>
        )
      }
    >
      <div className="px-5 pt-1 pb-5">
        {!hasKey && (
          <p className="mb-4 rounded-sm bg-danger-bg px-4 py-3 text-[12.5px] leading-relaxed font-bold text-danger">
            伺服器還沒設定 <b>LINE_CREDENTIALS_KEY</b>，沒有金鑰不能加密憑證，
            所以現在存不進去。設好環境變數再回來。
          </p>
        )}

        {state.connected ? (
          <>
            <Field label="目前連到的帳號">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-sm bg-sunk px-4 py-3">
                <b className="num text-[13px] font-extrabold text-primary">
                  {state.botBasicId || '（沒有 ID）'}
                </b>
                <span className="text-[13px] font-bold">{state.botDisplayName}</span>
              </div>
              <p className="mt-1.5 text-[11.5px] text-ink-3">
                這是系統拿你的 token 去問 LINE 得到的答案，不是你自己打的。
              </p>
            </Field>

            <div className="grid gap-x-3.5 sm:grid-cols-2">
              <Field label="Channel secret">
                <div className="num rounded-sm bg-sunk px-4 py-3 text-[13px] text-ink-3">
                  {state.secretTail}
                </div>
              </Field>
              <Field label="Access token">
                <div className="num rounded-sm bg-sunk px-4 py-3 text-[13px] text-ink-3">
                  {state.tokenTail}
                </div>
              </Field>
            </div>
          </>
        ) : (
          <p className="mb-4 text-[12.5px] leading-relaxed text-ink-2">
            接上之後，預約確認與行前提醒都會用<b className="font-extrabold">你自己的名義</b>
            發給客人。現在沒接，客人約完只看得到網頁上的確認，你也要自己記得提醒他們。
          </p>
        )}

        {(editing || !state.connected) && (
          <div className="mt-1 rounded-sm bg-sunk px-4 pt-4 pb-2">
            <div className="grid gap-x-3.5 sm:grid-cols-2">
              <Field label="Channel ID" optional>
                <TextBox
                  className="num bg-card"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="2007xxxxxx"
                />
              </Field>
              <Field label="Channel secret">
                <TextBox
                  className="num bg-card"
                  value={channelSecret}
                  onChange={(e) => setChannelSecret(e.target.value)}
                  placeholder="Basic settings 那一頁"
                  autoComplete="off"
                />
              </Field>
            </div>
            <Field
              label="Channel access token（長期）"
              hint="Messaging API 那一頁最下面。存進去之後就再也不會顯示完整內容。"
            >
              <TextBox
                className="num bg-card"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="貼上長期的 access token"
                autoComplete="off"
              />
            </Field>
            <div className="flex flex-wrap gap-2 pb-2">
              <PrimaryButton
                disabled={pending || !hasKey}
                onClick={() => run(() => saveChannel({ channelId, channelSecret, accessToken }))}
              >
                {pending ? '驗證中…' : '驗證並儲存'}
              </PrimaryButton>
              {state.connected && (
                <QuietButton onClick={() => setEditing(false)} disabled={pending}>
                  取消
                </QuietButton>
              )}
            </div>
          </div>
        )}

        {state.connected && (
          <>
            <Field
              label="Webhook URL"
              hint="貼回 LINE Developers 的 Messaging API 分頁，並把「Use webhook」打開。沒貼這一步，客人傳訊息我們收不到。"
            >
              <div className="flex items-center gap-2 rounded-sm bg-sunk py-2 pr-2 pl-4">
                <span className="num min-w-0 flex-1 truncate text-[12px] text-ink-2">
                  {webhookUrl}
                </span>
                <CopyLinkButton url={webhookUrl} />
              </div>
              <p className="mt-1.5 text-[11.5px] font-bold">
                {state.webhookVerifiedAt ? (
                  <span className="text-ok">✓ 已經收到過 LINE 送來的事件，webhook 是通的</span>
                ) : (
                  <span className="text-warn">還沒收到任何事件，貼上去之後傳一句話測試</span>
                )}
              </p>
            </Field>

            {/* 綁定碼：不用「第一個傳訊息的人就是老闆」，那等於誰先傳誰是老闆 */}
            <Field
              label="你自己的 LINE"
              hint="要發測試訊息、之後要用一句話建立預約，系統都得先知道你本人的 LINE 是哪一個。"
            >
              {state.operatorBound ? (
                <p className="rounded-sm bg-ok-bg px-4 py-3 text-[12.5px] font-bold text-ok">
                  ✓ 已經綁好了
                </p>
              ) : state.bindCode ? (
                <div className="rounded-sm bg-accent px-4 py-3.5">
                  <p className="text-[12px] font-semibold text-accent-foreground">
                    用你自己的 LINE 加這個官方帳號，然後把下面這串傳給它：
                  </p>
                  <p className="num mt-1.5 text-[19px] font-extrabold text-accent-foreground">
                    {state.bindCode}
                  </p>
                </div>
              ) : (
                <p className="rounded-sm bg-sunk px-4 py-3 text-[12.5px] text-ink-3">
                  目前沒有可用的綁定碼。
                </p>
              )}
            </Field>

            <div className="mt-1 flex flex-wrap gap-2">
              <PrimaryButton disabled={pending} onClick={() => run(sendTestMessage)}>
                發測試訊息給我
              </PrimaryButton>
              <QuietButton disabled={pending} onClick={() => run(recheckChannel)}>
                重新檢查連線
              </QuietButton>
              <QuietButton disabled={pending} onClick={() => run(regenerateBindCode)}>
                換一組綁定碼
              </QuietButton>
              <QuietButton disabled={pending} onClick={() => setEditing(true)}>
                重貼憑證
              </QuietButton>
              <QuietButton danger disabled={pending} onClick={() => run(disconnectChannel)}>
                中斷連線
              </QuietButton>
            </div>
          </>
        )}

        {state.loadError && (
          <p className="mt-3 rounded-sm bg-danger-bg px-3.5 py-2.5 text-[12px] leading-relaxed font-bold text-danger">
            讀不到已儲存的設定：{state.loadError}
            <br />
            這不代表你剛才沒存進去——先別重貼，把這行訊息貼給工程師。
          </p>
        )}
        {message && (
          <p className="mt-3 rounded-sm bg-ok-bg px-3.5 py-2.5 text-[12.5px] font-bold text-ok">
            {message}
          </p>
        )}
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Card>
  )
}

type ActionLike = { ok: true; message?: string } | { ok: false; error: string }
