// 登入後要導回哪裡。這個值來自網址參數，等於是使用者可控的輸入，
// 直接拿去 redirect 會變成開放轉址（被拿來把人導去釣魚站），
// 所以只接受站內的相對路徑。

export function safeNextPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || !value) return fallback

  // 必須是單一斜線開頭的相對路徑：
  // 「//evil.com」與「/\evil.com」都會被瀏覽器當成外部網址
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback

  return value
}
