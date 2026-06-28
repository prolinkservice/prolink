export async function pushLineMessage(lineUserId: string, text: string) {
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
        messages: [{ type: 'text', text }],
      }),
    })
    if (!res.ok) {
      console.error('LINE push message rejected', res.status, await res.text(), { lineUserId })
    }
  } catch (err) {
    console.error('LINE push message failed', err)
  }
}
