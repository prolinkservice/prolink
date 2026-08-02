# ProLink 產品規格書

> 職人預約 SaaS 平台
> 最後更新：2026-07-28

---

## 0. 一句話定位

**給各式職人的預約與客戶管理 SaaS。** 職人擁有自己的品牌、自己的客人、自己的 LINE 官方帳號；平台提供工具，只收訂閱費，不碰交易金流、不做媒合。

### 從媒合平台轉向 SaaS 的六個反轉

| 面向 | 舊（媒合） | 新（SaaS） |
|---|---|---|
| 流量 | 平台導客給職人 | 職人自帶客 |
| 客人歸屬 | 平台會員，跨職人共用 | **職人的客人，租戶隔離** |
| 收入 | 抽成 10% | 訂閱月費，**零抽成** |
| 上架 | 需審核 | 註冊即用 |
| LINE | 平台一個官方帳號 | **每個租戶自己的官方帳號** |
| 品牌 | ProLink 品牌 | 職人自己的品牌 |

---

## 1. 商業模式

### 1.1 方案

| 方案 | 價格 |
|---|---|
| 體驗 | **NT$0**，1 位服務人員、**100 位客戶** |
| 進階 | **NT$449／位服務人員／月**，上限 **NT$4,499／月**，客戶無上限 |

- 月繳不綁約、無建置費、無開通費
- 簡訊照則計費；LINE 訊息依 LINE 官方計價
- 按人頭計價讓收入隨客戶成長；設上限讓多人沙龍不會算出天價
- **不設每月預約筆數上限**：100 位客戶已是足夠的天然天花板，兩道限制反而難解釋

#### 功能分界

| 功能 | 體驗 | 進階 |
|---|---|---|
| 線上預約頁、行事曆、手動建單、結帳登記 | ✅ | ✅ |
| **放鳥計點與黑名單** | ✅ | ✅ |
| **時數券與儲值金** | ✅ | ✅ |
| 銀行轉帳定金 | ✅ | ✅ |
| 報表檢視 | ✅ | ✅ |
| **任何自動通知**（預約確認、行前提醒、取消通知） | ❌ | ✅ |
| 自帶 LINE 官方帳號 | ❌ | ✅ |
| 店家 LINE Pay / INSTO 線上收定金 | ❌ | ✅ |
| 自動回訪、券到期提醒 | ❌ | ✅ |
| 資料匯出 | ❌ | ✅ |
| 多位服務人員與多據點 | ❌ | ✅ |

> **免費版完全沒有通知，是刻意的。** 兩個理由：① 平台不必替免費用戶負擔 LINE／簡訊費用；② 通知正是職人最有感的價值，體驗過「客人自己約、系統自己提醒」之後才會想付費。免費版讓他把流程數位化，付費版讓他不用再自己盯。

> **黑名單與時數券刻意放進免費版。** 這兩項不產生平台成本，卻是職人最痛的兩件事（奧客、預收款記帳）。免費就能用，導入意願才高。

### 1.2 差異點

夯客整合的是自家的 LINE 模組；**ProLink 讓職人用自己的官方帳號**，品牌與客戶關係 100% 歸職人。不打價格戰。

### 1.3 平台唯一碰錢的地方

訂閱費，走綠界定期定額。收的是自己的錢，無法遵疑慮。

---

## 2. 核心架構

### 2.1 多租戶

一個 **Tenant** = 一個職人品牌／工作室。所有資料表帶 `tenant_id`，RLS 一律以此為隔離邊界，**無例外**。

### 2.2 可預約標的（Bookable）— 本專案的核心抽象

一般美業系統以「人」為中心（一筆預約 = 一位設計師 + 一段時間）。ProLink 支援的場景裝不進這個模型：

| 場景 | 實際佔用什麼 |
|---|---|
| 按摩推拿 | 師傅 ×1 + 包廂 ×1 |
| 團課 | 教練 ×1 + 教室 ×1（教室容納 12 人） |
| 場地租借 | **只有場地，沒有人** |
| 美髮 | 設計師 ×1 + 洗髮台 ×1，且染燙等待可並行接客 |

因此核心抽象是 **Bookable**：可以是人、場地、器材，各自有容量。服務項目宣告需要哪些標的，引擎負責分配與防衝堂。

**這是相對競品的主要技術差異點，Sprint 0 就要做對。**

### 2.3 客人不需要平台帳號

從職人的 LINE 或預約連結進來，以**手機號碼**為主要識別（有綁 LINE 則同時記 `line_user_id`）。`customers.auth_user_id` 可為 null。摩擦愈低，職人愈願意把客人導進來。

### 2.4 網址形態（2026-07-28 定案）

**採路徑式：`prolink.tw/p/wangteacher`**

不做子網域、不做自訂網域。理由：實作最簡單、SSL 不用另外處理、`/p/` 前綴天然隔離出命名空間，職人的 slug 不可能撞到 `/admin`、`/api`、`/login` 這些系統路徑。

| 規則 | 決定 |
|---|---|
| 字元 | 小寫英數與連字號（`a-z0-9-`），**不接受中文** |
| 長度 | 3–30 字元 |
| 唯一性 | 全站唯一 |
| 大小寫 | 一律轉小寫 |
| 可否修改 | **可改，但保留舊 slug 永久 301 轉址** |

> **不接受中文的理由**：`prolink.tw/p/王老師` 在 LINE 訊息裡會被展開成一長串百分號編碼的亂碼，職人不會想把那個貼給客人。

> **舊 slug 要保留轉址**：客人的書籤、名片上印的連結、LINE 對話記錄裡的舊連結都會失效。需要 `tenant_slug_history` 表記錄舊 slug 與變更時間。

### 2.5 不做公開目錄（2026-07-28 定案）

平台**不提供**職人搜尋、分類瀏覽、排行榜或任何聚合頁。做了就會把定位拉回媒合平台。

| 項目 | 決定 |
|---|---|
| `prolink.tw` 首頁 | **產品官網**（介紹 SaaS、定價、註冊），不是搜尋入口 |
| 站內搜尋職人 | 不做 |
| 分類／地區瀏覽頁 | 不做 |
| 職人個人頁 SEO | **開啟**。那是職人自己要的流量，平台不擋 |
| 平台聚合 SEO | 不做 |

差別在於：**職人的頁面要能被 Google 搜到，但平台不做把他們排在一起比較的頁面。**

---

## 3. 垂直市場與優先順序

| 優先 | 垂直 | 預約模型 |
|---|---|---|
| 1 | **按摩推拿／整復** | 單次、固定時長、師傅+包廂、部分到府 |
| 2 | **健身房場地租借** | 按小時、純資源無人力、定期預約 |
| 3 | 美甲美睫 | 按摩的簡化版（去掉包廂），Sprint 1 完成時即支援 |
| 4 | 教練／團課 | 席次、成團／流團、候補 |
| 5 | 美髮沙龍 | 需「服務分段佔用」（染燙等待並行），暫緩 |

---

## 4. 預約流程

### 4.1 狀態機

```
pending（待確認）
  ├─→ confirmed ──┬─→ completed（到店，結帳登記）
  │                ├─→ no_show（放鳥）           ★ 計 1 點
  │                └─→ cancelled_late（臨時取消） ★ 計 0.5 點
  ├─→ cancelled（正常取消）        不計點
  └─→ expired（逾時未確認自動釋出） 不計點
```

### 4.2 結案（現場付款的必要配套）

預約時間結束後 2 小時仍停在 `confirmed`，進「待結案」清單。老師三選一：**有來結帳 / 沒出現 / 取消不計**。

- 不自動判定放鳥。誤判一次可能得罪一個好客人
- 首頁紅點提示；隔天早上 LINE 提醒一次
- 結帳登記：實收金額、付款方式，**沒有這一步就沒有營收報表**
- 付款方式六種：**現金／轉帳／刷卡／1hr 券／30min 券／儲值金**，支援混合付款（見 §7.1）
- 服務定價是「參考價」，實收以結帳登記為準

### 4.3 免費版沒有通知，狀態機要跟著調整

「預約確認機制」（客人在 LINE 一鍵確認、24 小時未確認自動釋出）**建立在通知之上**。免費版沒有通知，這條流程會卡死——客人根本不知道要確認。

| | 體驗（無通知） | 進階（有通知） |
|---|---|---|
| 線上預約送出後 | 直接進 `confirmed` | 進 `pending`，發通知請客人確認 |
| 24h 未確認自動釋出 | **不適用** | 適用 |
| 職人怎麼知道有新預約 | 後台紅點（自己開來看） | LINE 通知 |
| 客人怎麼知道約成功 | 網頁確認畫面；**成功頁須顯示職人的 LINE，有疑問直接問** | 網頁 ＋ LINE 通知 |
| 銀行轉帳定金 | 成功頁顯示帳號、客人填後五碼、職人在「待核帳」處理 | 同左，另發通知 |

實作上以租戶的方案旗標決定走哪條路徑，`auto-cancel-pending` 這支排程只對付費租戶生效。

### 4.4 手動建立預約

老師接電話要能自己登記。**SaaS 缺這個等於不能用**，P0。

---

## 5. 定金與退款

### 5.1 用字

一律用**「定金」**（民法 §248-249），非「訂金」。定金有法定效果：客人違約可依法沒收。

### 5.2 收取設定

| 項目 | 設計 |
|---|---|
| 金額 | 不收 / 固定金額 / 定價百分比 |
| 收取條件 | 一律收 / 僅新客 / 僅信用不良 / 特定服務 / 特定日期 |
| 付款模式 | `none` / `deposit`（定金） / `full`（全額預收，場租常用） |
| 成立時機 | 付款成功才鎖時段；付款頁停留期間暫時鎖定 15 分鐘 |
| 抵扣 | 結帳時 實收 = 定價 − 已付定金 |

### 5.3 退款規則

只有**一個參數**：`refundable_hours`（預設 48）。不做完整取消政策引擎。

| 情境 | 定金處理 | 依據 |
|---|---|---|
| 提前 48h 以上取消 | 全額退 | 合意解除 |
| 48h 內取消 | 沒收 | 民法 §249①，可歸責客人 |
| 放鳥未到 | 沒收 | 同上 |
| **職人取消** | **全額退**（可選加倍補償） | 民法 §249②，**職人違約應加倍返還** |
| 不可抗力 | 全額退 | 不可歸責雙方 |
| 職人通融 | 全額退 | 覆蓋規則，需填原因 |

> ⚠️ 職人取消時，系統要跳出「民法 §249② 加倍返還」的警示。平台預設只退原額，加倍與否由職人自行決定，平台不自動扣款。

### 5.4 金流：BYO（自帶金流帳號）

**平台不碰錢。** 參考夯客驗證過的模式。

| 方式 | 適用 | 流程 |
|---|---|---|
| 銀行轉帳 | 免費方案唯一選項 | 顯示職人帳號 → 客人轉帳填後五碼 → 職人手動核帳 |
| LINE Pay | 付費方案，**公司戶／個人戶皆可申請** | 職人貼上自己的 Channel ID / Secret |
| INSTO | 付費方案，**個人可申請** | 職人輸入帳密驗證 |

> **選這兩家的唯一理由：個人戶也能申請。** 台灣多數單人職人沒有公司行號，傳統金流申請不到。BYO 的摩擦不在「要自己申請」，而在「申請不到」。

**因此砍掉四個模組：** 撥款結算、平台退款 API、平台抽成分潤、代收代付法遵評估。

### 5.5 退款 = 待辦，不是交易

平台不持有款項，無法執行退款，只能驅動職人去退並記錄結果。

```
退款條件成立
  → 產生退款待辦（金額、對象、原因、金流交易編號）
  → 後台紅點 + LINE 通知職人
  → 職人到 LINE Pay / INSTO 後台實際退款
  → 回系統點「已退款」（可填退款交易編號）
  → 自動 LINE 通知客人「定金已退還」
  → 逾 3 日未處理，每日提醒
```

「沒收」在 BYO 下極乾淨：**不產生待辦即可**。

### 5.6 必要的揭露

- 結帳頁明示「本筆定金由 **○○工作室** 收取」，不能讓客人誤以為平台收款
- 服務條款寫明：定金之收取、保管與退還為職人與客人間之契約關係，平台僅提供記錄與通知工具

### 5.7 程式介面

```ts
interface PaymentProvider {
  id: 'linepay' | 'insto' | 'bank_transfer'
  createDepositCharge(booking, amount): Promise<{ payUrl?, instructions?, providerTxnId }>
  verifyCallback(payload): Promise<{ status, providerTxnId }>
  // 刻意不提供 refund()：BYO 模式下退款由職人自行到金流後台操作
}
```

日後若改為平台代收，只需補 `refund()` 與底層實作，上層業務邏輯不動。

### 5.8 Onboarding

BYO 最大摩擦是「不知道怎麼申請」。必須做：

1. LINE Pay 與 INSTO 的**個人戶申請教學**（含所需文件）
2. 申請中的狀態顯示（審核約 1–2 週）
3. **等待期間先用銀行轉帳定金**，不讓職人卡住無法開張

這一段做得好不好，直接決定付費轉換率。

---

## 6. 放鳥與黑名單

定金是第一層嚇阻（即時、有感、合法），黑名單處理累犯。

### 6.1 計點

共用 `refundable_hours` 這一個時間門檻，老師只需理解一個數字。

| 行為 | 定金 | 點數 |
|---|---|---|
| 48h 內取消 | 沒收 | 0.5 |
| 放鳥未到 | 沒收 | 1.0 |

### 6.2 黑名單

| 項目 | 設計 |
|---|---|
| 自動封鎖 | 累計達 N 點自動列入。N 預設 **3**，可調 1–10，可關閉 |
| 計算期間 | 滾動 **12 個月**（預設）／永久累計 |
| 封鎖時長 | 永久（預設）／ 90 天自動解除；老師可隨時解除 |
| 手動封鎖 | 客戶詳情頁一鍵，填原因（內部備註） |
| 豁免名單 | VIP 可標記不套用自動規則 |
| 識別鍵 | **手機號碼**為主；有綁 LINE 則同時擋 `line_user_id` |
| 稽核記錄 | 每次封鎖／解封寫 log（時間、操作者、自動或手動、當時點數） |

### 6.3 被封鎖的客人看到什麼

**不顯示「你已被列入黑名單」。** 預設文案：

> 線上預約目前無法使用，請直接與店家聯繫。

- 文案可自訂
- 在「送出預約」那一步擋，不在進頁面就擋（避免被試探出規則）

### 6.4 黑名單絕對不跨租戶共享

A 老師的黑名單只在 A 老師店內生效。跨租戶共用「奧客名單」在個資法上屬於替客人建立信用評等，法律風險極高，且會讓產品定位飄回平台。**寫進產品原則，不留後門。**

> 註：夯客的客人評分是跨商家共享的。這是他們的選擇，我們不跟進。

### 6.5 其他防放鳥配套

| 配套 | 說明 |
|---|---|
| 預約確認機制 | 客人需在 LINE 一鍵確認，24h 未確認自動釋出（現有 cron 可沿用） |
| 兩段式提醒 | 前一天晚上 + 當天前 2 小時 |
| **提醒訊息內含「無法前往」按鈕** | 取消愈好按，放鳥愈少 |
| 新客須加 LINE 好友才能預約 | 可開關 |
| 客戶卡信賴標記 | 顯示「到店 12 · 放鳥 1 · 臨時取消 2」 |

---

## 7. 客戶管理（CRM）

| 功能 | 優先 |
|---|---|
| 客戶列表：搜尋、標籤／最後到訪／消費額篩選、批次操作 | P0 |
| 客戶詳情：基本資料、LINE 綁定、預約歷史、消費統計 | P0 |
| 客戶備註：服務偏好、禁忌事項 | P0 |
| **CSV 匯入**（從 Excel 搬既有客戶，導入最大阻力） | P0 |
| 標籤／黑名單 | P1 |
| 自動分群：新客／回頭客／沉睡客(90天)／VIP(前20%) | P1 |
| 療程照片（前後對比） | P1 |
| **時數券／儲值金**（見 §7.1） | P1 |
| 自動回訪（依上次服務 + 建議週期排 LINE 訊息） | P1 |
| 資料匯出（客戶能帶走自己的資料 = SaaS 信任基礎） | P1 |

### 7.1 時數券與儲值金

#### 底層以「分鐘」記帳，券只是購買面額

| 動作 | 效果 |
|---|---|
| 買 1hr 券 | 時數餘額 +60 分鐘 |
| 買 30min 券 | 時數餘額 +30 分鐘 |
| 做 90 分鐘服務 | 直接扣 90 分鐘 |

**理由：不會卡住。** 若純用「張數」記，客人只剩 1 張 1hr 券卻要做 90 分鐘就湊不出來，老師當場尷尬。用分鐘記就自然變成「扣 60 分鐘 + 剩下 30 分鐘用現金補」，混合付款順順地過去。

顯示上仍講人話：「剩餘 3.5 小時」，不是「剩餘 210 分鐘」。

#### 販售：老師自己填，系統不做贈額規則

**不做「儲 10,000 送 1,000」這類規則引擎。** 老師販售時自己輸入兩個獨立的數字：

```
收款金額：NT$ 10,000
給予時數：11 小時        ← 老師自己判斷要給 10 還是 11
到期日：  2027-07-28     ← 老師自己設定
```

要送就直接多給時數，不需要系統計算。這讓實作簡單很多，也符合職人實際談價的方式。

#### 因此不需要分開記本金與贈額

退款時以**實際單價**計算即可：

```
實際單價 = 售價 ÷ 總時數 = 10,000 ÷ 11 = 909 元/小時
已使用 3 小時 → 已耗用 2,727 → 應退 7,273
```

自然涵蓋了贈額的情況，不必額外設計。

#### 到期日

- **由老師自行設定**，每筆販售各自獨立（可從套餐帶預設值，販售時可改）
- 快到期時自動發 LINE 提醒客人——這同時是催客人回來的好理由
- 到期後餘額歸零，但紀錄保留可查

#### 儲值金

獨立於時數餘額的金額錢包，規則相同：老師自訂儲值金額與實得金額、自訂到期日。

#### 資料表

```sql
packages(id, tenant_id, name, kind minutes|money,
         default_amount,          -- 面額：分鐘數 或 金額
         default_price,           -- 建議售價
         default_valid_days,      -- 建議效期
         is_active)

customer_packages(id, tenant_id, customer_id, package_id,
                  paid_amount,             -- 客人實付
                  granted_amount,          -- 實得（分鐘 或 金額），老師可自訂
                  remaining_amount,        -- 剩餘
                  unit_price,              -- paid_amount ÷ granted_amount，退款用
                  expires_at,              -- 老師自訂
                  sold_by, sold_at, status active|used_up|expired|refunded)

package_transactions(id, tenant_id, customer_package_id, booking_id,
                     delta,                -- 負數為扣抵，正數為補回（取消預約時）
                     reason, created_at)
```

扣抵順序：**先到期的先扣**（FIFO by `expires_at`），避免客人的券白白過期。

---

## 8. 多據點與移動時間

### 8.1 跨地點鎖定：架構已涵蓋

老師本人是 `type=staff` 的 bookable，**地點只是預約的屬性，不是佔用對象**。所以 A 點被約走，B、C 點同時段自動不可約——由資料庫的 exclusion constraint 直接擋掉，不需額外邏輯。

### 8.2 三種地點模式（設在服務項目層級）

| 模式 | 說明 |
|---|---|
| `fixed` | 單一固定店面 |
| `multi_site` | 老師在多個據點輪流跑 |
| `mobile` | 無固定地點，純約老師時段（到府、線上、客人自備場地） |

同一位老師可同時有「到店」與「到府」兩種服務。

### 8.3 情境式 Buffer

間隔拆成兩種來源，**歸屬不同、不可重複設定**：

| 來源 | 設在哪 | 意思 | 預設 |
|---|---|---|---|
| 服務緩衝 | **服務項目**（`buffer_before_min` / `buffer_after_min`） | 這項服務需要的準備與整理時間。老師可自由設定數值，也可整個關閉（＝前後都 0） | 前 0、後 10 |
| 跨點移動 | **可預約標的**（`cross_site_travel_min`）＋ 地點對矩陣 | 換地點要開多久。同一地點不計 | 30 分 |
| `mobile` 移動 | **可預約標的**（`default_travel_min`） | 到府時的固定移動時間 | 30 分 |

> **為什麼緩衝時間屬於服務而非標的**：不同服務需要的整理時間本來就不同（推拿要換床單，諮詢不用）。若標的層級再放一個「同點翻台間隔」，兩者會疊加成雙倍，老師會納悶為什麼中間空這麼多。標的層級只管「換地點要開多久」。

**採地點對矩陣**（據點通常 2–5 個，矩陣很小，老師自己最清楚車程）。存單向，UI 預設兩邊同值。

Google Maps 動態計算**不進即時路徑**——每次算可預約時段都打 API 會變成效能地雷。可作為「一鍵帶入建議值」的輔助。

### 8.4 間隔用相加，不用取大值

```
前一筆結束 11:00
  + 服務後置整理 10 分  → 11:10 才能離開 A 點
  + A→B 移動 30 分      → 11:40 抵達 B 點
  + 下一筆服務前置 5 分 → 11:45 才能開始
∴ B 點最早可約 11:45
```

收拾要在原地做完才能上路。排太滿老師會遲到，遲到比空堂傷客更重。

### 8.5 據點排班：一天可以有多個地點

`business_hours` 一天可以有**多列**，每列是「星期幾 · 幾點到幾點 · 哪個地點」。時間可以重疊也可以不重疊。三種老師型態都是這張表的不同填法，**不需要兩套介面、也不需要問老師是哪一型**：

| 型態 | 填法 | 行為 |
|---|---|---|
| **固定型** | 每天只勾一個地點 | 週二整天在六合，五甲的服務完全不出現 |
| **彈性型** | 每天勾多個地點 | 哪裡都可能跑，去哪由客人的預約決定 |
| **分時段型** | 同一天加第二段時間，各綁各的地點 | 10:00–14:00 五甲、15:30–21:00 六合，中間刻意留空 |

> 彈性做法本來就包含固定做法：只勾一個地點時，行為與固定模式完全相同。固定型的老師甚至感覺不到「可以複選」這件事。

### 8.6 銜接檢查必須雙向

一個候選時段要通過**三項**檢查才顯示給客人：

1. **前一筆到得了嗎** — 從上一筆預約的地點趕過來，來不來得及
2. **後一筆走得了嗎** — 做完之後趕去下一筆的地點，來不來得及
3. **時段本身沒被佔用**

> **只往前看會出事。** 實例：18:00 六合有一筆 60 分、20:30 五甲有一筆，六合→五甲 25 分。客人想約六合 19:30–20:30——往前看沒問題（人本來就在六合），但往後看趕不回五甲，必須擋掉。漏了第 2 項，20:30 那位客人就會被放鴿子。

反推方式：

```
20:30 五甲開始 − 前緩衝 5 分  = 20:25 須抵達五甲
                − 車程 25 分   = 20:00 須離開六合
                − 後緩衝 10 分 = 19:50 六合那筆最晚必須結束
```

### 8.7 時段一律以 30 分鐘為單位（2026-07-28 定案）

**線上預約的可選時段一律對齊 `:00` 與 `:30`。** 不開放 1 分鐘或 5 分鐘的精細度。

| 規則 | 說明 |
|---|---|
| 起始時間 | 一律落在 `:00` 或 `:30` |
| 銜接計算的零頭 | **無條件進位到下一個 30 分刻度** |
| 服務時長 | 不受限制（45 分、90 分皆可），只有「起始時間」對齊 |
| 手動建單 | **不受此限制**，老師可填任意時間 |

計算範例：

```
19:00 六合結束 → +後緩衝10 +車程25 +前緩衝5 = 19:40
                 ↓ 進位到 30 分刻度
                 20:00 ← 客人實際看到的最早時段
```

**三個好處：**

1. **客人端乾淨。** 時段列表是 19:00 / 19:30 / 20:00，不會出現 19:40、15:45 這種怪數字
2. **進位的零頭變成額外緩衝。** 上例多出 20 分鐘，老師更不會遲到
3. **引擎簡單很多。** 候選時段是固定格點，不用逐分鐘掃描

> 遇到卡在格點之間的特殊情況（例如客人只有 19:40 有空），**由職人自己跟客人討論後手動建單**，系統不為此增加複雜度。

### 8.8 附加功能

- **今日路線檢視**：行程順序 + 地點 + 每段的 Google Maps 導航連結。到府老師每天都會看，實作成本半天
- **移動衝突警示**：手動建單時若間隔不足，跳警示但**允許強制建立**（老師可能就住附近）

---

## 9. LINE 整合

### 9.1 BYO Channel

每個租戶自己的 Messaging API channel。憑證由職人在後台填入。

| 項目 | 設計 |
|---|---|
| Webhook | `/api/line/webhook/[tenantId]`，簽章用該租戶的 secret |
| 憑證儲存 | **加密存放，絕不明文入庫**。Access Token 等同「可用職人名義發訊給所有好友」 |
| LIFF | 每租戶一個（LIFF 綁 channel），LIFF ID 存租戶設定 |
| 過渡 | 尚未接自有 OA 者，用平台 OA 發送。抽象成 `getMessagingClient(tenantId)` |

### 9.2 訊息用量看板

LINE 免費方案每月 200 則。系統會自動發確認、提醒、回訪，很容易爆量然後客戶收到 LINE 帳單來罵。

**後台顯示「本月已發 X / 額度 Y」，80% 時警告。** 同類產品普遍沒做，做了就是差異化。

### 9.3 圖文選單一鍵套用

用 API 幫租戶把 OA 選單設成「立即預約 / 我的預約 / 聯絡我」。導入時的 Aha moment。

### 9.4 老師端：一句話建立預約

老師在 LINE 打「8/2 晚上7點 六合健身房 陳小姐 推拿90分」→ 系統解析成卡片 → 老師確認 → 進系統。

**三個關鍵決定：**

1. **永遠先出確認卡，不直接建單。** 語意理解必有誤判，多按一次換零開錯單
2. **看不懂就問，不要猜。** 缺日期就反問，不填預設值
3. **地點與服務要對得上租戶自己的設定。** 對不到就列清單讓他點選

衝突時直接顯示衝突原因並列出當天最近的空檔。

草稿：[`docs/mockups/line-booking.html`](mockups/line-booking.html)

### 9.5 客人端：查時段並預約

圖文選單「我要預約」→ 列出可約時段（時刻表樣式）→ 點選 → LIFF 確認頁 → 付定金 → 成立。

**三個關鍵決定：**

1. **只列真的可以約的時段。** 被約走的、老師不在該據點的、來不及移動的通通不出現
2. **先選時間，再選地點。** 老師到處跑，時段本來就綁著地點
3. **提醒訊息一定要有「取消」按鈕**

全程不用註冊、不用下載 App。

### 9.6 群組機器人（未來，但現在就要預留）

**正式路徑是一對一私訊**。群組是同一個 channel、同一個 webhook 的分支（LINE 會告知訊息來自 user 還是 group），不是另一套系統。

未來要開群組時，成本取決於現在有沒有預留這七件事：

| # | 預留項目 | 不留的後果 |
|---|---|---|
| 1 | 每筆 LINE 訊息存**來源類型**與來源 ID | 群組預約無法歸屬 |
| 2 | 預約分存 **誰建立** 與 **誰要用**（助理代訂 ≠ 本人自訂） | 代訂功能要改表 |
| 3 | 用**操作者角色表**判斷誰能確認，不寫死「老師本人」 | 管理員機制重寫 |
| 4 | **群組綁定表**先建好（可無 UI） | 同上 |
| 5 | 「一句話 → 預約」解析做成**獨立模組**，不綁來源 | 群組要重寫一份解析 |
| 6 | 回覆**話多話少依來源決定**（群組必須安靜，只對有日期+時間的訊息反應） | 洗版被踢出群 |
| 7 | 通知可指定**回群組 or 私訊當事人** | 通知發錯地方 |

以上全是欄位與模組切法，不增加當期開發量。

草稿：[`docs/mockups/gym-group-booking.html`](mockups/gym-group-booking.html)

---

## 10. 場地租借（健身房）

### 10.1 現況（六合健身房）

教練在 LINE 群跟助理說「8/2 19:00-20:00 預約空間」，助理或老闆確認即可。

**痛點不是教練端，是助理端**：憑印象查撞期、月底翻整個月 LINE 算時數。

### 10.2 規格

| 項目 | 決定 |
|---|---|
| 計價 | **按小時**，價格由老闆自行設定 |
| 價格歸屬 | **綁在場地上**（主訓練區與多功能教室可不同價） |
| 尖峰離峰 | MVP 不做，欄位預留 |
| 門禁 | **不做**。櫃檯都有人 |
| 定期預約 | 支援（每週固定時段） |
| 付款模式 | 通常 `full`（全額預收）而非定金 |

門禁拿掉後，場租就是「按小時的單一資源預約」，現有引擎直接吃得下。

### 10.3 角色對應

| 場景角色 | 系統對應 |
|---|---|
| 健身房 | Tenant |
| 場地（主訓練區、多功能教室） | Bookable (type=space) |
| **教練** | **Customer** |
| 場地租借 | Service (price_unit = per_hour) |
| 助理、老闆 | Tenant Member（有確認權） |

**架構完全不用改，只是角色換名字。**

### 10.4 核心價值：自動對帳單

月底自動產出每位教練的使用時數與金額，一鍵發到群組或個別發送，可匯出 Excel。

每筆都有時間與確認人，教練有疑問直接調紀錄。

### 10.5 職人同時是別家的客人（不做整合）

一個人可以同時是**租戶 A 的老闆**與**租戶 B 的客人**——例如自己開工作室，同時也去健身房租場地。兩邊資料完全隔離，健身房看不到他的客人，他也看不到健身房其他教練的預約。他去租場地時甚至不需要登入，跟一般客人一樣用手機號碼。

**刻意不做跨租戶整合。** 但有一個已知後果：他在別家租的時段不會出現在自己的行事曆上，可能重複預約自己。

| 解法 | 階段 |
|---|---|
| 自己在後台加一筆「不開放」把該段擋掉 | MVP 即可 |
| **對方系統發 LINE 通知 → 一鍵在自己行事曆建立封鎖** | **未來**（2026-07-28 確認方向，暫不排期） |
| 完整跨租戶行事曆同步 | 不做 |

第二項不算整合——只是把通知變成一個按鈕，兩邊資料仍各自獨立。

### 10.6 擴散路徑

教練天天用到這套系統，而教練自己也需要管自己的客人——**他就是下一個付費用戶**。從健身房進去一次接觸十幾個潛在客戶。

---

## 11. 資料表結構

```sql
-- ══ 租戶 ══
tenants(id, slug, name, timezone, plan, status)
  -- slug：小寫英數與連字號，3–30 字，全站唯一。網址為 /p/{slug}
tenant_slug_history(id, tenant_id, old_slug, changed_at)
  -- 舊網址永久 301 轉址，避免名片與 LINE 訊息裡的連結失效
tenant_members(id, tenant_id, user_id, role owner|manager|staff, display_name, is_bookable)
locations(id, tenant_id, name, address, lat, lng, type onsite|mobile)

-- ══ 可預約標的（核心抽象）══
bookables(id, tenant_id, location_id,
          type staff|space|equipment,
          member_id,                    -- type=staff 時指向 tenant_members
          name, capacity int default 1, color, sort_order, is_active,
          hourly_price,                 -- 場地按小時計價
          same_site_turnaround_min default 10,
          cross_site_travel_min default 30,
          default_travel_min default 30)

-- ══ 服務項目 ══
services(id, tenant_id, name, category, description,
         duration_min, duration_mode fixed|hourly,
         min_hours, max_hours,
         buffer_before_min, buffer_after_min,
         price, price_unit per_session|per_hour|per_person,
         location_mode fixed|multi_site|mobile,
         service_area jsonb,
         payment_mode none|deposit|full,
         deposit_type none|fixed|percent, deposit_value,
         deposit_condition always|new_customer|low_credit|specific_date,
         capacity int default 1,
         min_headcount int,
         is_active)

service_requirements(id, service_id, bookable_type, bookable_id, quantity)
  -- 按摩：staff×1 + space×1｜場租：space×1｜團課：staff×1 + space×1

-- ══ 營業時間 ══
business_hours(id, tenant_id, bookable_id, location_id, weekday, start_time, end_time)
schedule_exceptions(id, tenant_id, bookable_id, date, is_closed, start_time, end_time, note)
location_travel_times(id, tenant_id, from_location_id, to_location_id, minutes)
  UNIQUE(tenant_id, from_location_id, to_location_id)

-- ══ 客戶 ══
customers(id, tenant_id, name, phone, email, line_user_id, auth_user_id,
          birthday, gender, source, first_visit_at, last_visit_at,
          total_spent, visit_count,
          no_show_points numeric default 0,
          is_blocked, blocked_at, blocked_reason, blocked_until, is_exempt)
  UNIQUE(tenant_id, phone)

customer_tags(id, tenant_id, name, color)
customer_tag_map(customer_id, tag_id)
customer_notes(id, customer_id, author_id, body, created_at)
customer_incidents(id, tenant_id, customer_id, booking_id,
                   type no_show|late_cancel, points, occurred_at)
blocklist_logs(id, tenant_id, customer_id, action block|unblock,
               is_auto, reason, points_at_time, actor_id, created_at)

-- ══ 預約 ══
bookings(id, tenant_id, customer_id, service_id, location_id, series_id,
         start_at, end_at,
         status pending|confirmed|completed|no_show|cancelled|cancelled_late|expired,
         source online|manual|line_dm|line_group|walk_in,   -- ★ 群組預留
         created_by_line_user_id,                            -- ★ 誰建立（代訂用）
         confirmed_by,                                       -- ★ 誰確認
         headcount int default 1,
         quoted_price, actual_amount, payment_method,
         service_address, service_address_lat, service_address_lng,
         note, internal_note,
         confirmed_at, closed_at, closed_by)

booking_bookables(booking_id, bookable_id)     -- ★ 防衝堂關鍵表
booking_series(id, tenant_id, rrule, until_date)

-- ══ 定金（BYO 金流）══
tenant_payment_accounts(id, tenant_id, provider linepay|insto|bank_transfer,
                        credentials_encrypted, bank_info, status, verified_at, last_error)
payments(id, tenant_id, booking_id, provider, amount,
         status pending|paid|expired|failed,
         provider_txn_id, payer_last5, paid_at, expires_at)
refund_tasks(id, tenant_id, booking_id, payment_id, amount, reason,
             status pending|done|waived, refund_txn_id, done_at, done_by)

-- ══ LINE ══
tenant_line_channels(id, tenant_id, channel_id,
                     channel_secret_encrypted, access_token_encrypted,
                     liff_id, webhook_verified_at, status)
tenant_line_operators(id, tenant_id, line_user_id, role admin|staff, bound_at)  -- ★ 誰能確認
tenant_line_groups(id, tenant_id, group_id, purpose, bound_at, bound_by)        -- ★ 群組預留
line_message_logs(id, tenant_id, customer_id, source_type user|group, source_id,
                  type, sent_at, quota_month)

-- ══ 設定與計費 ══
tenant_settings(tenant_id,
                refundable_hours default 48,
                no_show_threshold default 3,
                late_cancel_points default 0.5,
                block_window_months default 12,
                block_duration permanent|90d,
                blocked_message, require_line_friend,
                auto_confirm_when_free bool)      -- 場租自動核准
subscriptions(id, tenant_id, plan, seats, amount, period_start, period_end,
              ecpay_merchant_trade_no, status)

-- ══ P1 ══
packages / customer_packages / wallet_transactions
reviews(tenant_id, booking_id, rating, body, is_public)
```

### 11.1 給後端的兩個技術重點

1. **防衝堂**：`booking_bookables` + PostgreSQL `tstzrange` 的 GiST exclusion constraint，讓資料庫層直接擋掉重複佔用，不要只靠應用層檢查
2. **容量 > 1 的團課例外**：exclusion constraint 不適用，改用交易內 `SELECT ... FOR UPDATE` 加總席次判斷。兩條路徑分開寫

---

## 12. 設計系統

**方案 B「柔光日光」**（2026-07-28 定案）：大圓角、無邊框、柔和層次陰影、低彩度鼠尾草綠。

完整代幣與元件庫：[`docs/mockups/design-system.html`](mockups/design-system.html)

### 全站四條鐵則

1. **不用邊框線分層** —— 要分層就用陰影或凹陷底色
2. **一個畫面只能有一顆主色按鈕**
3. **數字一律等寬對齊**（時間、金額、電話）
4. **狀態不能只靠顏色**，一定要有文字

### 高密度模式

行事曆、時段列表這類每天要看很多次的地方，間距收緊、數字加粗等寬對齊。這仍是同一套風格，只是密度調高。

### 工作方式

**任何 UI 或流程設計，都先產出獨立 HTML 草稿放在 `docs/mockups/`，說明用白話版，經確認後才寫進 `src/`。**

---

## 13. 現有程式碼處置

> 現有系統無真實用戶與交易資料，**可直接重構**。

| 保留沿用 | 改造 | 移除 |
|---|---|---|
| 預約／時段引擎 | `profiles` → `customers`（租戶隔離） | `/practitioners` 目錄與搜尋 |
| layout-builder 品牌頁 | `practitioners` → `tenants` + `members` | 媒合／推薦邏輯 |
| LINE Login / LIFF 基礎 | LINE 單一憑證 → 每租戶憑證 | `commission.ts` 抽成 |
| `auto-cancel-pending` cron | ECPay → 只做訂閱定期定額 | 平台代收、撥款、退款 API |
| followup cron | admin 從審核者 → 客服工具 | 平台審核上架流程 |
| 存摺／證件驗證 | 評價 → 職人自己的口碑牆 | 平台仲裁取消 |
| `client_notes` | | 訂金／線上收款舊流程 |

---

## 14. Sprint 規劃

| Sprint | 內容 | 估時 | 狀態 |
|---|---|---|---|
| **0** | Schema + RLS + 租戶骨架 + 認證改造（客人免註冊） | 1 週 | ✅ 完成 |
| **1** | 按摩推拿完整可用：服務項目、營業時間、據點排班、線上預約頁、**手動建立預約**、行事曆、結帳登記 | 2 週 | ✅ 完成 |
| **2** | 自帶 LINE 官方帳號串接 + 一對一預約流程 + 兩段式提醒 + 訊息用量看板 | 2 週 | 🔨 第一批完成 |
| **3** | 場地租借：按小時、定期預約、場地表、**月底自動對帳單** | 1.5 週 | 未開始 |
| **4** | 客戶管理 CRM + 放鳥計點 + 黑名單 + CSV 匯入 | 1.5 週 | 🔨 列表完成 |
| **5** | 定金 BYO 金流（銀行轉帳 + LINE Pay + INSTO）+ 退款待辦 + 對帳 | 1.5 週 | 未開始 |
| **6** | 地點對矩陣 + 服務區域 + 今日路線檢視 | 1 週 | 🔨 矩陣完成 |
| **7** | 訂閱計費 + 報表 | 1.5 週 | 未開始 |
| **8+** | 群組機器人、團課（成團／流團／候補）、次卡儲值 | — | 未開始 |

**首個實測場域：六合健身房。** 有真實使用者、真實痛點、且現行流程完全清楚，是做新產品最難得的條件。

### 14.1 目前進度（2026-08-02）

**已經在正式站上能用的**

| 功能 | 驗證方式 |
|---|---|
| 服務項目（含複製、拖曳排序） | 實際操作 |
| 營業時間、據點、資源、每週排班、移動時間 | 實際操作 |
| 可預約時段引擎 | 用獨立測試租戶跑過規格 §8.6 的雙向銜接情境 |
| 客人線上預約（選服務→時段→手機送出） | 打 RPC 驗過：搶同一格、黑名單、亂填手機、非營業時段 |
| 今日行程、行事曆週檢視 | 畫面確認 |
| 手動建單、結帳登記 | 只有 build 綠燈，**尚未實際點過** |
| 客戶列表與分群 | 畫面確認（目前 0 位客人） |
| LINE 官方帳號串接 | **雙向實測通過**：webhook 收得到、測試訊息發得出 |

**環境設定的現況**

- LINE 官方帳號：`@800cjhif` 揚翼運動按摩，狀態 active，操作者已綁定
- `LINE_CREDENTIALS_KEY` 已設在 `.env.local` 與 Vercel 三個環境。**換掉這組，已存的 LINE 憑證會全部解不開，必須重貼**
- 正式站是 `prolink-delta.vercel.app`。`prolink.tw` 目前指向 Netlify 的舊站，**還沒切過來**
- Supabase Redirect URLs 已放行 localhost 與 vercel 網域；切 `prolink.tw` 時要補上

**接下來**

1. Sprint 2 第二批：客人加好友自動綁定、預約成立自動發確認、取消通知
2. Sprint 2 第三批：兩段式行前提醒（前一晚 + 出發前 2 小時）+ 訊息裡的「無法前往」按鈕
3. 客人詳情頁（預約歷史、備註、手動封鎖）、CSV 匯入

**已知缺口**

- 專案沒有測試框架，純函式的規則（時段格點、地址樓層、分群）只能靠手動跑案例驗證
- 舊的 `/practitioner` 目錄與全站共用的 `LINE_MESSAGING_*` 環境變數還沒清（規格 §13）

---

## 15. 待決事項

| # | 項目 | 狀態 |
|---|---|---|
| ~~1~~ | ~~網址形態~~ | ✅ 定案：`prolink.tw/p/slug`，見 §2.4 |
| ~~2~~ | ~~是否保留公開目錄~~ | ✅ 定案：不做，見 §2.5 |
| 3 | 場地尖峰離峰價差 | 暫緩，欄位預留 |
| 4 | 團課成團／流團的判定時點與流團退款 | Sprint 8 前決定 |

已無阻擋 Sprint 0 的未決事項。

---

## 附錄：草稿檔案

| 檔案 | 內容 |
|---|---|
| [`mockups/style-directions.html`](mockups/style-directions.html) | 三種 UI 風格比較（已選定 B） |
| [`mockups/design-system.html`](mockups/design-system.html) | 方案 B 完整設計代幣與元件庫 |
| [`mockups/line-booking.html`](mockups/line-booking.html) | LINE 一對一預約流程（老師端／客人端／後台） |
| [`mockups/gym-group-booking.html`](mockups/gym-group-booking.html) | 健身房場地群組預約（未來功能） |
