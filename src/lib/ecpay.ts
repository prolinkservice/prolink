import crypto from 'crypto'

// 綠界官方公開測試環境憑證（正式上線前替換成商家審核通過後的正式金鑰）
const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID ?? '2000132'
const HASH_KEY = process.env.ECPAY_HASH_KEY ?? '5294y06JbISpM5x9'
const HASH_IV = process.env.ECPAY_HASH_IV ?? 'v77hoKGq4kWxNNIS'
const CHECKOUT_URL = process.env.ECPAY_CHECKOUT_URL ?? 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5'

function ecpayEncode(str: string) {
  return encodeURIComponent(str)
    .toLowerCase()
    .replace(/%2d/g, '-')
    .replace(/%5f/g, '_')
    .replace(/%2e/g, '.')
    .replace(/%21/g, '!')
    .replace(/%2a/g, '*')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
    .replace(/%20/g, '+')
}

export function genCheckMacValue(params: Record<string, string>) {
  const sortedKeys = Object.keys(params).sort()
  const raw = `HashKey=${HASH_KEY}&${sortedKeys.map((k) => `${k}=${params[k]}`).join('&')}&HashIV=${HASH_IV}`
  const encoded = ecpayEncode(raw)
  return crypto.createHash('sha256').update(encoded).digest('hex').toUpperCase()
}

export function genMerchantTradeNo(bookingId: string) {
  return `PL${Date.now().toString(36)}${bookingId.replace(/-/g, '').slice(0, 6)}`.slice(0, 20)
}

export function buildCheckoutParams({
  merchantTradeNo,
  amount,
  itemName,
  returnUrl,
  clientBackUrl,
}: {
  merchantTradeNo: string
  amount: number
  itemName: string
  returnUrl: string
  clientBackUrl: string
}) {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const tradeDate = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${String(now.getUTCDate()).padStart(2, '0')} ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}`

  const params: Record<string, string> = {
    MerchantID: MERCHANT_ID,
    MerchantTradeNo: merchantTradeNo,
    MerchantTradeDate: tradeDate,
    PaymentType: 'aio',
    TotalAmount: String(Math.round(amount)),
    TradeDesc: 'ProLink預約付款',
    ItemName: itemName,
    ReturnURL: returnUrl,
    ChoosePayment: 'Credit',
    ClientBackURL: clientBackUrl,
    EncryptType: '1',
  }

  return { ...params, CheckMacValue: genCheckMacValue(params) }
}

export function verifyCheckMacValue(params: Record<string, string>) {
  const { CheckMacValue, ...rest } = params
  return genCheckMacValue(rest) === CheckMacValue
}

export const ECPAY_CHECKOUT_URL = CHECKOUT_URL

// 信用卡關帳後的退刷／取消／放棄動作，文件：https://developers.ecpay.com.tw/?p=2885
// Action：C=關帳 R=退刷 E=取消關帳 N=放棄
const REFUND_URL = process.env.ECPAY_REFUND_URL ?? 'https://payment-stage.ecpay.com.tw/CreditDetail/DoAction'

export async function doCreditCardRefund({
  merchantTradeNo,
  tradeNo,
  totalAmount,
}: {
  merchantTradeNo: string
  tradeNo: string
  totalAmount: number
}) {
  const params: Record<string, string> = {
    MerchantID: MERCHANT_ID,
    MerchantTradeNo: merchantTradeNo,
    TradeNo: tradeNo,
    Action: 'R',
    TotalAmount: String(Math.round(totalAmount)),
  }
  params.CheckMacValue = genCheckMacValue(params)

  const res = await fetch(REFUND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  const text = await res.text()
  const result = Object.fromEntries(new URLSearchParams(text))
  // 綠界回應格式：1|OK 代表成功，其餘代表失敗訊息
  const ok = text.startsWith('1|')
  return { ok, raw: text, result }
}
