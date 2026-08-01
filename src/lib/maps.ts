// 地址轉成地圖連結。前後端共用，不匯入伺服器模組。
//
// 一律用 Google Maps 的 api=1 網址格式：手機上裝了 App 會直接開 App，
// 沒裝就開網頁版。這是 Google 官方保證可用的格式，
// 舊的 maps.google.com/?q= 在部分 Android 上會被當成一般網頁開，
// 使用者就會覺得「點了沒反應」。

const BASE = 'https://www.google.com/maps'

/**
 * 樓層要在送進地圖前拿掉。
 *
 * 「高雄市鳳山區鳳南路301號20樓」丟給 Google，它會把終點解析成附近一個
 * 叫「20樓」的地點——實測導航距離只有 850 公尺，去到完全不相干的地方。
 * 砍掉樓層變成「…301號」就準確落在那棟樓，連裡面的店家都列得出來。
 *
 * 「號之N」是門牌增編不是樓層，必須留著：
 * 「…76號之1」與「…76號」可能是不同棟，切掉會指到隔壁。
 *
 * 只影響地圖連結，畫面上顯示的仍然是老師填的完整地址——
 * 客人到了門口還是需要知道要上 20 樓。
 */
function withoutFloor(address: string): string {
  // 有門牌號就切到「號」（含後面的「之N」）為止，巷、弄、段都在它前面
  const doorNumber = address.match(/^(.*?號(?:\s*之\s*\d+)?)/)
  if (doorNumber) return doorNumber[1].trim()

  // 沒有門牌號的地址（大樓名、園區）只砍結尾的樓層。
  // 要有數字在前才砍，否則「研發大樓」會被誤傷
  return address.replace(/\s*(?:B\s*)?\d+\s*(?:樓|F|f)(?:\s*之\s*\d+)?\s*$/, '').trim() || address
}

function destination(address: string | null | undefined): string | null {
  const value = (address ?? '').trim()
  return value ? encodeURIComponent(withoutFloor(value)) : null
}

/** 開地圖看這個地點在哪 */
export function mapsSearchUrl(address: string | null | undefined): string | null {
  const target = destination(address)
  return target && `${BASE}/search/?api=1&query=${target}`
}

/**
 * 直接開導航。不指定起點，讓地圖用使用者的目前位置——
 * 老師在路上，起點永遠是「現在人在哪」，不是上一個據點的地址。
 */
export function mapsDirectionsUrl(address: string | null | undefined): string | null {
  const target = destination(address)
  return target && `${BASE}/dir/?api=1&destination=${target}&travelmode=driving`
}
