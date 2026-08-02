import { issueLinkToken, readLinkToken } from '../src/lib/line/linkToken'
import { looksLikeBookingRequest } from '../src/lib/line/notify'

// 純規則的自我檢查。專案還沒有測試框架，而這兩塊都是「錯了不會當掉、
// 只會安靜地做錯事」的東西：記號解不開就是綁不到人，關鍵字判錯就是
// 對客人答非所問。改到這兩處之後跑一次：
//
//   npm run preflight
//
// 需要 .env.local 裡的 LINE_CREDENTIALS_KEY（記號的加解密要用）。

const TENANT = 'b3dba19a-bfc9-4a1d-9ecf-02277330f15e'
const OTHER = '00000000-0000-0000-0000-000000000000'
const USER = 'U4af8399c2b1d0e5f6a7b8c9d0e1f2a3b'

let failed = 0
function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected
  if (!ok) failed++
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  → 拿到 ${String(actual)}，應該是 ${String(expected)}`}`
  )
}

console.log('── 綁定記號 ──')
const token = issueLinkToken({ tenantId: TENANT, lineUserId: USER })
console.log(`記號 ${token?.length} 字元　網址：/p/youngyeebody?ref=${token?.slice(0, 20)}…`)

check('正常解得開', readLinkToken(token, TENANT), USER)
check('別家店的記號解不開', readLinkToken(token, OTHER), null)
check('被改過就解不開', readLinkToken((token ?? '').slice(0, -2) + 'AA', TENANT), null)
check('沒有記號時回 null', readLinkToken(null, TENANT), null)
check('亂填的回 null', readLinkToken('隨便打的東西', TENANT), null)
check('29 天後還有效', readLinkToken(token, TENANT, Date.now() + 29 * 864e5), USER)
check('31 天後過期', readLinkToken(token, TENANT, Date.now() + 31 * 864e5), null)
// base64url 本來就不含需要編碼的字元，所以放進網址來回一趟不會變形
check('放進網址來回一趟還是一樣', readLinkToken(encodeURIComponent(token ?? ''), TENANT), USER)

console.log('\n── 客人打什麼會拿到預約卡片 ──')
for (const t of ['預約', '我要預約', '請問可以預約嗎？', '立即預約', '訂位', '約時間', '約', '想約', '時段', ' 預 約 ']) {
  check(`「${t}」要回`, looksLikeBookingRequest(t), true)
}
for (const t of [
  '你好', '大約六點到', '約會', '謝謝', '腰痛適合做哪一種？', '',
  '我要取消預約', '想改期', '預約可以改時間嗎',
  '我想問一下你們那邊有沒有在做那種運動按摩然後可以順便處理腰的預約嗎',
]) {
  check(`「${t || '(空白)'}」不回`, looksLikeBookingRequest(t), false)
}

console.log(failed ? `\n${failed} 項沒過` : '\n全部通過')
process.exit(failed ? 1 : 0)
