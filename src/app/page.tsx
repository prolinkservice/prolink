import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCurrentTenant } from '@/lib/tenant'
import { Stamp } from '@/components/Stamp'

// 登入與註冊都走 /auth，那頁才有 Google 與 LINE。
// 舊的 /login、/signup 是媒合時代的會員登入，只有帳號密碼，
// 現在一律轉到 /auth（見 src/app/login/page.tsx）。
const LOGIN_HREF = '/auth?next=%2Fdashboard'
const SIGNUP_HREF = '/auth?mode=signup&next=%2Fdashboard'

// 產品官網首頁。舊版是「找老師的搜尋入口」，轉型後訪客不是消費者，
// 是想把預約流程數位化的職人，所以整頁只有一個目標：讓他按下註冊。
// 草稿：docs/mockups/landing-and-onboarding.html

export const metadata: Metadata = {
  title: '職人連結 ProLink · 你的客人，職人連結幫你管理',
  description:
    '給按摩推拿、整復、健身教練、場地租借等各式職人的預約與客戶管理系統。用自己的 LINE 官方帳號接單，不抽成。',
}

const AUDIENCES = [
  { label: '按摩推拿', primary: true },
  { label: '整復', primary: true },
  { label: '健身教練', primary: true },
  { label: '場地租借', primary: true },
  { label: '美甲美睫' },
  { label: '美髮' },
  { label: '瑜伽' },
  { label: '寵物美容' },
  { label: '攝影' },
  { label: '家教' },
]

const FEATURES = [
  {
    mark: 'L',
    title: '用你自己的官方帳號',
    body: '綁上你原本的 LINE 官方帳號，客人在裡面查時段、預約、收提醒。客人是你的好友，不是我們的。',
  },
  {
    mark: '時',
    title: '不會再撞期',
    body: '兩個據點加到府？系統自己算車程，來不及的時段客人根本看不到，不用你在腦中排班。',
  },
  {
    mark: '定',
    title: '定金先收，放鳥自動記',
    body: '綁你自己的 LINE Pay 收定金，錢直接進你的帳戶。放鳥累積到設定次數，系統自動擋掉線上預約。',
  },
  {
    mark: '客',
    title: '客人資料留得住',
    body: '誰幾個月沒回來、誰是 VIP、誰肩頸特別緊，一頁看完。舊客人可以從 Excel 一次匯入。',
  },
]

const FREE_PLAN = [
  { text: '線上預約頁與行事曆' },
  { text: '手動建立預約、結帳登記' },
  { text: '放鳥計點與黑名單' },
  { text: '時數券與儲值金' },
  { text: '定金以銀行轉帳收取' },
  { text: '沒有任何自動通知', off: true },
  { text: '不能自動回訪', off: true },
  { text: '不能匯出資料', off: true },
]

const PRO_PLAN = [
  { text: '綁自己的 LINE 官方帳號', strong: true },
  { text: '自動通知：預約確認、行前提醒、取消通知', strong: true },
  { text: '店家 LINE Pay / INSTO 線上收定金' },
  { text: '自動回訪與到期提醒' },
  { text: '完整報表與資料匯出' },
  { text: '多位服務人員與據點' },
]

type Props = { searchParams: Promise<{ code?: string }> }

export default async function Home({ searchParams }: Props) {
  // Supabase 的 Redirect URLs 若沒放行我們的 callback，GoTrue 會退回 Site URL，
  // 把 ?code= 掛在首頁上——沒人接，使用者就「登入完回到首頁，還是未登入」。
  // 這裡把它接住轉給 callback，設定沒調好也能登入成功。
  const { code } = await searchParams
  if (code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}&next=%2Fdashboard`)
  }

  // 登入完會回到這一頁。標頭若永遠只有「登入」，人會以為自己沒登入成功，
  // 而且從官網完全找不到路進後台
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 標頭顯示店名而不是信箱。信箱是登入用的，招牌才是他認得的自己；
  // 還沒建工作室的人只能退回信箱
  const current = user ? await getCurrentTenant() : null
  const whoami = current?.tenant.name ?? current?.member.display_name ?? user?.email ?? ''

  return (
    <div className="min-h-full">
      <header className="bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5 text-[17px] font-extrabold tracking-tight">
            <Stamp name="P" className="size-8 text-[14px]" />
            ProLink
          </Link>
          <nav className="ml-6 hidden gap-6 sm:flex">
            <a href="#features" className="text-[13.5px] font-semibold text-ink-3 hover:text-ink">功能</a>
            <a href="#pricing" className="text-[13.5px] font-semibold text-ink-3 hover:text-ink">定價</a>
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            {user ? (
              <>
                <span className="hidden items-center gap-2 sm:flex">
                  {current && <Stamp name={whoami} className="size-7 text-[12px]" />}
                  <b className="max-w-[22ch] truncate text-[13px] font-extrabold">{whoami}</b>
                </span>
                <Link
                  href="/dashboard"
                  className="rounded-full bg-primary px-5 py-2.5 text-[13.5px] font-extrabold text-primary-foreground transition hover:brightness-95"
                >
                  進入後台
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={LOGIN_HREF}
                  className="rounded-full bg-sunk px-5 py-2.5 text-[13.5px] font-extrabold text-ink-2 transition hover:bg-accent hover:text-accent-foreground"
                >
                  登入
                </Link>
                <Link
                  href={SIGNUP_HREF}
                  className="rounded-full bg-primary px-5 py-2.5 text-[13.5px] font-extrabold text-primary-foreground transition hover:brightness-95"
                >
                  免費開始
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 pt-10 pb-12 text-center sm:pt-20 sm:pb-14">
        <span className="inline-block rounded-full bg-accent px-3 py-1.5 text-[11px] font-bold tracking-[0.14em] text-accent-foreground uppercase">
          給各式職人的預約系統
        </span>

        {/* 固定兩行斷句，不讓瀏覽器自己斷在詞中間 */}
        <h1 className="mx-auto mt-5 text-[clamp(30px,5.2vw,52px)] leading-[1.22] font-extrabold tracking-[-0.04em]">
          你的客人
          <br />
          <em className="not-italic text-primary">職人連結</em>幫你管理
        </h1>

        <p className="mx-auto mt-4 max-w-[44ch] text-[15px] leading-relaxed text-ink-3 sm:mt-5 sm:text-[16.5px]">
          用你自己的 LINE 官方帳號接單、管客人、收定金。品牌是你的，客人也是你的——我們只提供工具，不抽成、不搶你的客人。
        </p>
        <div className="mx-auto mt-7 flex max-w-xs flex-col gap-2.5 sm:mt-8 sm:max-w-none sm:flex-row sm:justify-center sm:gap-3">
          <Link
            href={SIGNUP_HREF}
            className="rounded-full bg-primary px-8 py-4 text-[15px] font-extrabold text-primary-foreground transition hover:brightness-95"
          >
            免費開始，不用信用卡
          </Link>
          <a
            href="#features"
            className="rounded-full bg-sunk px-8 py-4 text-[15px] font-extrabold text-ink-2 transition hover:bg-accent hover:text-accent-foreground"
          >
            看功能
          </a>
        </div>
        <p className="mt-4 text-[12.5px] font-semibold text-ink-4">
          免費方案永久可用 · 月繳不綁約 · 隨時可取消
        </p>

        {/* 手機橫向滑動，避免三張卡直向堆疊把首屏拉得太長 */}
        <div className="-mx-6 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 sm:mx-auto sm:mt-14 sm:max-w-5xl sm:flex-wrap sm:justify-center sm:gap-5 sm:overflow-visible sm:px-0">
          <ArtCard title="客人在 LINE 上選時段" mark="客">
            <ArtSlot time="19:00" place="六合健身房" action="選這個" />
            <ArtSlot time="19:30" place="六合健身房" action="選這個" />
            <ArtSlot time="20:30" place="五甲工作室" action="已滿" muted />
            <ArtSlot time="22:00" place="五甲工作室" action="選這個" />
          </ArtCard>

          <ArtCard title="你打一句話就開單" mark="你">
            <p className="mb-2 ml-6 rounded-2xl rounded-tr-[5px] bg-primary px-3 py-2.5 text-[11.5px] leading-relaxed text-primary-foreground">
              8/2 晚上7點 六合 陳小姐 推拿90分
            </p>
            <p className="rounded-2xl rounded-tl-[5px] bg-sunk px-3 py-2.5 text-[11.5px] leading-relaxed">
              <b className="num font-extrabold">08/02（六）19:00–20:30</b>
              <br />
              六合健身房 · 陳小姐
              <br />
              <span className="font-extrabold text-ok">✓ 時段無衝突</span>
            </p>
          </ArtCard>

          <ArtCard title="月底自動出帳" mark="帳">
            <ArtSlot time="124k" place="本月營收" action="↑18%" />
            <ArtSlot time="68%" place="回頭客" action="↑4%" />
            <ArtSlot time="3.2%" place="放鳥率" action="↓" />
            <ArtSlot time="184" place="客戶總數" action="+12" />
          </ArtCard>
        </div>
      </section>

      {/* 適用對象 */}
      <section className="bg-card px-6 py-14">
        <h2 className="text-center text-2xl font-extrabold tracking-tight">做這些的人都在用</h2>
        <p className="mt-2.5 text-center text-[14.5px] text-ink-3">
          只要你的工作是「跟客人約時間」，這套就適合
        </p>
        <div className="mx-auto mt-7 flex max-w-3xl flex-wrap justify-center gap-2.5">
          {AUDIENCES.map((a) => (
            <span
              key={a.label}
              className={`rounded-full px-5 py-2.5 text-[13.5px] font-bold ${
                a.primary ? 'bg-accent text-accent-foreground' : 'bg-sunk text-ink-2'
              }`}
            >
              {a.label}
            </span>
          ))}
        </div>
      </section>

      {/* 功能 */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-16 px-6 py-16">
        <h2 className="text-center text-[26px] font-extrabold tracking-tight">你每天在煩的事，交給它</h2>
        <p className="mt-2 mb-9 text-center text-[14.5px] text-ink-3">
          不是功能表，是你今天就會遇到的四件事
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <article key={f.title} className="rounded-lg bg-card p-6 shadow-card">
              <div className="mb-3.5 grid size-9 place-items-center rounded-xl bg-accent text-[15px] font-extrabold text-accent-foreground">
                {f.mark}
              </div>
              <h3 className="text-[15.5px] font-extrabold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 定價 */}
      <section id="pricing" className="scroll-mt-16 bg-card px-6 py-16">
        <h2 className="text-center text-[26px] font-extrabold tracking-tight">定價</h2>
        <p className="mt-2.5 mb-9 text-center text-[14.5px] text-ink-3">
          月繳不綁約，沒有建置費、開通費，也不抽你的交易金額
        </p>
        <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2">
          <div className="rounded-xl bg-background p-7">
            <p className="text-xs font-extrabold tracking-[0.1em] text-ink-4 uppercase">體驗</p>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="num text-[38px] leading-none font-extrabold">0</span>
              <span className="text-[13px] font-bold text-ink-3">永久免費</span>
            </div>
            <p className="mt-1.5 text-xs font-semibold text-ink-4">1 位服務人員 · 100 位客戶</p>
            <ul className="mt-5">
              {FREE_PLAN.map((i) => (
                <PlanItem key={i.text} {...i} />
              ))}
            </ul>
            <Link
              href={SIGNUP_HREF}
              className="mt-6 block rounded-full bg-sunk py-3.5 text-center text-[13.5px] font-extrabold text-ink-2 transition hover:bg-accent hover:text-accent-foreground"
            >
              免費開始
            </Link>
          </div>

          <div className="rounded-xl bg-accent p-7">
            <p className="text-xs font-extrabold tracking-[0.1em] text-accent-foreground uppercase">進階</p>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="num text-[38px] leading-none font-extrabold text-accent-foreground">449</span>
              <span className="text-[13px] font-bold text-ink-3">／位服務人員／月</span>
            </div>
            <p className="mt-1.5 text-xs font-semibold text-ink-4">上限 NT$4,499／月 · 客戶無上限</p>
            <ul className="mt-5">
              {PRO_PLAN.map((i) => (
                <PlanItem key={i.text} {...i} />
              ))}
            </ul>
            <Link
              href={SIGNUP_HREF}
              className="mt-6 block rounded-full bg-primary py-3.5 text-center text-[13.5px] font-extrabold text-primary-foreground transition hover:brightness-95"
            >
              開始 14 天試用
            </Link>
          </div>
        </div>
      </section>

      {/* 收尾 */}
      <section className="px-6 py-16 text-center">
        <h2 className="text-[30px] leading-tight font-extrabold tracking-tight">
          五分鐘就能把預約連結
          <br />
          傳給你的客人
        </h2>
        <p className="mt-3.5 text-[15px] text-ink-3">不用信用卡、不用簽約、不用等業務打給你</p>
        <Link
          href={SIGNUP_HREF}
          className="mt-7 inline-block rounded-full bg-primary px-8 py-4 text-[15px] font-extrabold text-primary-foreground transition hover:brightness-95"
        >
          免費開始
        </Link>
      </section>

      <footer className="bg-card px-6 py-7">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 text-[12.5px] font-semibold text-ink-4">
          <span className="flex items-center gap-2 text-sm font-extrabold text-ink">
            <span className="grid size-5.5 place-items-center rounded-[7px] bg-primary text-[10px] text-primary-foreground">
              P
            </span>
            ProLink
          </span>
          <div className="ml-auto flex gap-5">
            <Link href="/privacy" className="hover:text-ink-2">隱私權政策</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function ArtCard({
  title,
  mark,
  children,
}: {
  title: string
  mark: string
  children: React.ReactNode
}) {
  return (
    <div className="w-[212px] shrink-0 snap-start overflow-hidden rounded-lg bg-card text-left shadow-card">
      <div className="flex items-center gap-2 p-3.5">
        <span className="grid size-5.5 place-items-center rounded-[7px] bg-accent text-[9px] font-extrabold text-accent-foreground">
          {mark}
        </span>
        <b className="text-[11.5px] font-extrabold">{title}</b>
      </div>
      <div className="px-3.5 pb-3.5">{children}</div>
    </div>
  )
}

function ArtSlot({
  time,
  place,
  action,
  muted,
}: {
  time: string
  place: string
  action: string
  muted?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-2.5 border-b border-hairline py-2 last:border-b-0 ${
        muted ? 'opacity-35' : ''
      }`}
    >
      <span className="num w-10 shrink-0 text-[13px] font-extrabold">{time}</span>
      <span className="flex-1 text-[10.5px] text-ink-3">{place}</span>
      <span className={`text-[9.5px] font-extrabold ${muted ? 'text-ink-4' : 'text-primary'}`}>
        {action}
      </span>
    </div>
  )
}

function PlanItem({ text, off, strong }: { text: string; off?: boolean; strong?: boolean }) {
  return (
    <li className={`relative py-1.5 pl-5.5 text-[13.5px] ${off ? 'text-ink-4' : 'text-ink-2'}`}>
      <span
        className={`absolute top-[15px] left-0.5 size-1.5 rounded-full ${
          off ? 'bg-ink-4' : 'bg-primary'
        }`}
      />
      {strong ? <b className="font-extrabold text-ink">{text}</b> : text}
    </li>
  )
}
