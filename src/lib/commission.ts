// 平台抽成比例：「付訂金」選項的訂金金額＝平台服務費，等於抽成比例，
// 確保即便客戶選擇現場付現或轉帳結清尾款，平台仍能透過線上收到這筆費用。
export const PLATFORM_COMMISSION_RATE = 0.1

export function calcCommission(price: number) {
  return Math.round(price * PLATFORM_COMMISSION_RATE)
}
