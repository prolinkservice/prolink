export async function getLineDisplayName(lineUserId: string): Promise<string | null> {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
  if (!token) return null

  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.displayName ?? null
  } catch (err) {
    console.error('LINE get profile failed', err)
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function pushLineFlexMessage(lineUserId: string, altText: string, contents: any) {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN
  if (!token) return

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'flex', altText, contents }],
      }),
    })
    if (!res.ok) {
      console.error('LINE push flex message rejected', res.status, await res.text(), { lineUserId })
    }
  } catch (err) {
    console.error('LINE push flex message failed', err)
  }
}
