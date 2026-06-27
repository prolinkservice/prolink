import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: '隱私權政策｜職人連結 ProLink',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />返回首頁
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-5 py-10 text-sm leading-relaxed text-foreground space-y-6">
        <header>
          <h1 className="text-2xl font-bold mb-2">隱私權政策</h1>
          <p className="text-muted-foreground">最後更新日期：2026年6月27日</p>
        </header>

        <p>
          職人連結 ProLink（以下稱「本平台」）重視您的隱私權。本政策說明我們在您使用本平台服務時，
          會收集哪些個人資料、如何使用與保護這些資料，以及您所享有的權利。
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">我們收集的資料</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>帳號資料：透過 Email、Google 或 LINE 登入時取得的姓名、電子郵件、頭像</li>
            <li>第三方登入識別碼：使用 Google／LINE 登入時，會儲存對應的帳號識別碼（不會取得您的密碼）</li>
            <li>預約相關資料：預約紀錄、服務地址（到府服務時）、付款方式、體質備註（僅老師與您本人可見）</li>
            <li>職人資料：店家地址、銀行帳戶、身分證件影像（僅用於平台審核，加密儲存並限制存取）</li>
            <li>裝置與使用紀錄：瀏覽紀錄、IP 位址等基本技術資訊，用於維護網站安全與穩定</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">資料使用目的</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>提供帳號登入與身分驗證</li>
            <li>處理預約、付款與服務媒合</li>
            <li>傳送預約相關通知（站內通知，若您綁定 LINE 帳號則包含 LINE 訊息推播）</li>
            <li>職人資格審核與平台安全管理</li>
            <li>改善網站功能與使用體驗</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">第三方服務</h2>
          <p>本平台使用以下第三方服務協助運作，您的資料可能依各服務之隱私權政策被處理：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Supabase（資料庫與帳號系統）</li>
            <li>Google（登入驗證、地圖服務）</li>
            <li>LINE（登入驗證、訊息推播通知，僅限您主動綁定或加入官方帳號好友後）</li>
            <li>綠界科技 ECPay（金流付款處理）</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">資料保護與保存</h2>
          <p>
            我們採取合理的技術與管理措施保護您的個人資料，避免遺失、被竊取、竄改或洩漏。
            身分證件等敏感資料儲存於僅限本人與平台審核人員可存取的加密空間。
            您的資料將保存至帳號存續期間，若您申請刪除帳號，我們將依法令規定期間後刪除或匿名化處理。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">您的權利</h2>
          <p>
            您可以隨時於會員中心查詢、更正您的個人資料，或聯絡我們申請停止收集、處理或利用、刪除帳號。
            若您透過 LINE 綁定接收通知，可隨時於 LINE 官方帳號封鎖或於會員中心解除綁定，停止接收推播訊息。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">聯絡我們</h2>
          <p>
            若您對本隱私權政策有任何疑問，歡迎透過平台客服信箱與我們聯繫。
          </p>
        </section>
      </div>
    </div>
  )
}
