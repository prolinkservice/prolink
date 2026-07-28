-- ═══════════════════════════════════════════════════════════════
-- ProLink · Sprint 0 核心結構
-- 職人預約 SaaS：多租戶 + 可預約標的（Bookable）抽象
-- 規格依據：docs/product-spec.md
-- ═══════════════════════════════════════════════════════════════

-- btree_gist 讓 uuid 的等值比較可以跟 tstzrange 的重疊比較放進同一個
-- exclusion constraint，這是防衝堂的關鍵前提
create extension if not exists btree_gist;

-- 共用的 updated_at 觸發器
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;


-- ═══════════════════════════════════════════════════════════════
-- 1. 租戶
-- ═══════════════════════════════════════════════════════════════

create table public.tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
                check (slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  name          text not null,
  timezone      text not null default 'Asia/Taipei',
  plan          text not null default 'free' check (plan in ('free','pro')),
  status        text not null default 'active' check (status in ('active','suspended','closed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on column public.tenants.slug is '網址用：prolink.tw/p/{slug}。小寫英數與連字號，3–30 字';

-- 改過 slug 之後舊網址要能 301 轉址，否則名片與 LINE 訊息裡的連結會全部失效
create table public.tenant_slug_history (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  old_slug    text not null unique,
  changed_at  timestamptz not null default now()
);

create table public.tenant_members (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  role          text not null default 'staff' check (role in ('owner','manager','staff')),
  display_name  text not null,
  is_bookable   boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (tenant_id, user_id)
);
comment on column public.tenant_members.is_bookable is '這位成員是否可被客人預約（櫃檯、助理設 false）';

create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  name        text not null,
  address     text,
  lat         double precision,
  lng         double precision,
  type        text not null default 'onsite' check (type in ('onsite','mobile')),
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 據點兩兩之間的移動時間。存單向，UI 預設兩邊同值但允許拆開
create table public.location_travel_times (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants on delete cascade,
  from_location_id  uuid not null references public.locations on delete cascade,
  to_location_id    uuid not null references public.locations on delete cascade,
  minutes           int not null check (minutes >= 0),
  unique (tenant_id, from_location_id, to_location_id),
  check (from_location_id <> to_location_id)
);


-- ═══════════════════════════════════════════════════════════════
-- 2. 可預約標的（Bookable）— 本專案的核心抽象
--    一筆預約佔用的可能是人、場地或器材，不一定是「人」
-- ═══════════════════════════════════════════════════════════════

create table public.bookables (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants on delete cascade,
  location_id   uuid references public.locations on delete set null,
  type          text not null check (type in ('staff','space','equipment')),
  member_id     uuid references public.tenant_members on delete cascade,
  name          text not null,
  capacity      int not null default 1 check (capacity >= 1),
  color         text,
  sort_order    int not null default 0,
  is_active     boolean not null default true,

  -- 場地按小時出租時的單價（type = 'space' 才會用到）
  hourly_price  numeric(10,2),

  -- 跨據點移動時間。同點的整理時間屬於「服務」的性質，
  -- 放在 services.buffer_before/after_min，不在這裡重複設定
  cross_site_travel_min     int not null default 30,
  default_travel_min        int not null default 30,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- type = staff 必須綁成員；其他類型不得綁
  check ((type = 'staff') = (member_id is not null))
);
comment on table public.bookables is
  '可預約標的。師傅、包廂、場地、器材都是同一種東西，差別只在 type 與 capacity';


-- ═══════════════════════════════════════════════════════════════
-- 3. 服務項目
-- ═══════════════════════════════════════════════════════════════

create table public.services (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants on delete cascade,
  name              text not null,
  category          text,
  description       text,

  -- 時長：固定時長（按摩）或客人自選時數（場租）
  duration_mode     text not null default 'fixed' check (duration_mode in ('fixed','hourly')),
  duration_min      int check (duration_min > 0),
  min_hours         numeric(4,2),
  max_hours         numeric(4,2),

  buffer_before_min int not null default 0,
  buffer_after_min  int not null default 0,

  price             numeric(10,2) not null default 0,
  price_unit        text not null default 'per_session'
                    check (price_unit in ('per_session','per_hour','per_person')),

  -- 地點模式：固定店面 / 多據點巡迴 / 無固定地點（到府、線上）
  location_mode     text not null default 'fixed'
                    check (location_mode in ('fixed','multi_site','mobile')),
  service_area      jsonb,

  -- 收款模式：不收 / 收定金 / 全額預收（場租常用）
  payment_mode      text not null default 'none' check (payment_mode in ('none','deposit','full')),
  deposit_type      text not null default 'none' check (deposit_type in ('none','fixed','percent')),
  deposit_value     numeric(10,2),
  deposit_condition text not null default 'always'
                    check (deposit_condition in ('always','new_customer','low_credit','specific_date')),

  capacity          int not null default 1 check (capacity >= 1),
  min_headcount     int,

  is_active         boolean not null default true,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  check (duration_mode <> 'fixed' or duration_min is not null)
);

-- 一個服務需要哪幾種標的。按摩 = staff×1 + space×1；場租 = space×1
create table public.service_requirements (
  id             uuid primary key default gen_random_uuid(),
  service_id     uuid not null references public.services on delete cascade,
  bookable_type  text not null check (bookable_type in ('staff','space','equipment')),
  bookable_id    uuid references public.bookables on delete cascade,
  quantity       int not null default 1 check (quantity >= 1)
);
comment on column public.service_requirements.bookable_id is
  '指定某個特定標的；為 null 表示該類型任一可用標的皆可';


-- ═══════════════════════════════════════════════════════════════
-- 4. 營業時間
-- ═══════════════════════════════════════════════════════════════

-- location_id 為 null = 不限地點（mobile 模式）
-- 巡迴老師：「週一三五在 A 館、週二四在 B 館」就靠這張表表達
create table public.business_hours (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants on delete cascade,
  bookable_id  uuid not null references public.bookables on delete cascade,
  location_id  uuid references public.locations on delete cascade,
  weekday      int not null check (weekday between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  check (end_time > start_time)
);

create table public.schedule_exceptions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants on delete cascade,
  bookable_id  uuid references public.bookables on delete cascade,
  date         date not null,
  is_closed    boolean not null default true,
  start_time   time,
  end_time     time,
  note         text
);


-- ═══════════════════════════════════════════════════════════════
-- 5. 客戶
--    客人不需要平台帳號，以手機號碼為主要識別
-- ═══════════════════════════════════════════════════════════════

create table public.customers (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants on delete cascade,
  name              text not null,
  phone             text,
  email             text,
  line_user_id      text,
  auth_user_id      uuid references auth.users on delete set null,
  birthday          date,
  gender            text,
  source            text,

  first_visit_at    timestamptz,
  last_visit_at     timestamptz,
  visit_count       int not null default 0,
  total_spent       numeric(12,2) not null default 0,

  -- 放鳥計點與黑名單
  no_show_points    numeric(5,2) not null default 0,
  is_blocked        boolean not null default false,
  blocked_at        timestamptz,
  blocked_reason    text,
  blocked_until     timestamptz,
  is_exempt         boolean not null default false,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (tenant_id, phone),
  unique (tenant_id, line_user_id)
);
comment on column public.customers.is_exempt is 'VIP 豁免：不套用自動封鎖規則';

create table public.customer_tags (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants on delete cascade,
  name       text not null,
  color      text,
  unique (tenant_id, name)
);

create table public.customer_tag_map (
  customer_id uuid not null references public.customers on delete cascade,
  tag_id      uuid not null references public.customer_tags on delete cascade,
  primary key (customer_id, tag_id)
);

create table public.customer_notes (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants on delete cascade,
  customer_id  uuid not null references public.customers on delete cascade,
  author_id    uuid references public.tenant_members on delete set null,
  body         text not null,
  created_at   timestamptz not null default now()
);

-- 放鳥與臨時取消的事件紀錄，黑名單的計算來源
create table public.customer_incidents (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants on delete cascade,
  customer_id  uuid not null references public.customers on delete cascade,
  booking_id   uuid,
  type         text not null check (type in ('no_show','late_cancel')),
  points       numeric(4,2) not null,
  occurred_at  timestamptz not null default now()
);

-- 封鎖／解封的稽核紀錄，日後客人來爭執才有依據
create table public.blocklist_logs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants on delete cascade,
  customer_id     uuid not null references public.customers on delete cascade,
  action          text not null check (action in ('block','unblock')),
  is_auto         boolean not null default false,
  reason          text,
  points_at_time  numeric(5,2),
  actor_id        uuid references public.tenant_members on delete set null,
  created_at      timestamptz not null default now()
);


-- ═══════════════════════════════════════════════════════════════
-- 6. 預約
-- ═══════════════════════════════════════════════════════════════

-- 定期預約（場租常見：每週二 19:00 固定）
create table public.booking_series (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants on delete cascade,
  rrule       text not null,
  until_date  date,
  created_at  timestamptz not null default now()
);

create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants on delete cascade,

  -- kind = 'block' 代表休假／維修／午休，走同一套防衝堂機制，
  -- 不必為「不開放時段」另外做一張表與另一套檢查
  kind          text not null default 'booking' check (kind in ('booking','block')),

  customer_id   uuid references public.customers on delete restrict,
  service_id    uuid references public.services on delete restrict,
  location_id   uuid references public.locations on delete set null,
  series_id     uuid references public.booking_series on delete set null,

  start_at      timestamptz not null,
  end_at        timestamptz not null,

  status        text not null default 'pending' check (status in
                  ('pending','confirmed','completed','no_show',
                   'cancelled','cancelled_late','expired')),

  source        text not null default 'manual' check (source in
                  ('online','manual','line_dm','line_group','walk_in')),

  -- 群組功能預留：誰建立的可能不等於這筆是誰要用的（助理代訂）
  created_by_line_user_id  text,
  created_by_member_id     uuid references public.tenant_members on delete set null,
  confirmed_by             uuid references public.tenant_members on delete set null,

  headcount     int not null default 1 check (headcount >= 1),

  quoted_price  numeric(10,2),
  actual_amount numeric(10,2),
  payment_method text check (payment_method in
                  ('cash','transfer','card','hour_pass','store_credit','mixed')),

  -- mobile 模式客人填的地址
  service_address      text,
  service_address_lat  double precision,
  service_address_lng  double precision,

  note          text,
  internal_note text,

  confirmed_at  timestamptz,
  closed_at     timestamptz,
  closed_by     uuid references public.tenant_members on delete set null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  check (end_at > start_at),
  check (kind = 'block' or customer_id is not null)
);

-- ★ 防衝堂的核心表
-- block_start / block_end 是「含 buffer 與移動時間」的實際佔用區間，
-- 跟 bookings 的服務時間不同：服務 19:00-20:30，但可能 18:50 就開始佔用
create table public.booking_bookables (
  booking_id        uuid not null references public.bookings on delete cascade,
  bookable_id       uuid not null references public.bookables on delete restrict,
  block_start       timestamptz not null,
  block_end         timestamptz not null,
  is_active         boolean not null default true,
  enforce_exclusive boolean not null default true,
  primary key (booking_id, bookable_id),
  check (block_end > block_start)
);
comment on column public.booking_bookables.is_active is
  '取消／放鳥／逾時後設為 false，時段立即釋出';
comment on column public.booking_bookables.enforce_exclusive is
  'capacity > 1 的團課不適用互斥約束，改由席次加總判斷（Sprint 6）';

-- 資料庫層直接擋掉同一標的的時間重疊，不倚賴應用層檢查
alter table public.booking_bookables
  add constraint booking_bookables_no_overlap
  exclude using gist (
    bookable_id with =,
    tstzrange(block_start, block_end, '[)') with &&
  ) where (is_active and enforce_exclusive);

-- 預約狀態改變時同步釋出／佔回時段
create or replace function public.sync_booking_block_state()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    update public.booking_bookables
       set is_active = new.status in ('pending','confirmed','completed')
     where booking_id = new.id;
  end if;
  return new;
end $$;

create trigger bookings_sync_block_state
  after update of status on public.bookings
  for each row execute function public.sync_booking_block_state();


-- ═══════════════════════════════════════════════════════════════
-- 7. 定金與金流（BYO：平台不碰錢）
-- ═══════════════════════════════════════════════════════════════

create table public.tenant_payment_accounts (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants on delete cascade,
  provider              text not null check (provider in ('linepay','insto','bank_transfer')),
  credentials_encrypted text,
  bank_info             jsonb,
  status                text not null default 'pending'
                        check (status in ('pending','active','error','disabled')),
  verified_at           timestamptz,
  last_error            text,
  created_at            timestamptz not null default now(),
  unique (tenant_id, provider)
);
comment on column public.tenant_payment_accounts.credentials_encrypted is
  '一律加密存放。此憑證等同「可用職人名義收款」，絕不明文入庫';

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants on delete cascade,
  booking_id      uuid not null references public.bookings on delete cascade,
  provider        text not null check (provider in ('linepay','insto','bank_transfer')),
  amount          numeric(10,2) not null check (amount > 0),
  status          text not null default 'pending'
                  check (status in ('pending','paid','expired','failed')),
  provider_txn_id text,
  payer_last5     text,
  paid_at         timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz not null default now()
);

-- 平台不持有款項，無法執行退款。這張表是「待辦」，不是交易
create table public.refund_tasks (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants on delete cascade,
  booking_id     uuid not null references public.bookings on delete cascade,
  payment_id     uuid references public.payments on delete set null,
  amount         numeric(10,2) not null,
  reason         text not null,
  status         text not null default 'pending'
                 check (status in ('pending','done','waived')),
  refund_txn_id  text,
  done_at        timestamptz,
  done_by        uuid references public.tenant_members on delete set null,
  created_at     timestamptz not null default now()
);


-- ═══════════════════════════════════════════════════════════════
-- 8. LINE
-- ═══════════════════════════════════════════════════════════════

create table public.tenant_line_channels (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants on delete cascade unique,
  channel_id               text,
  channel_secret_encrypted text,
  access_token_encrypted   text,
  liff_id                  text,
  webhook_verified_at      timestamptz,
  status                   text not null default 'pending'
                           check (status in ('pending','active','error','disabled')),
  created_at               timestamptz not null default now()
);

-- 誰按得動「確認」。不要寫死成「老師本人」，群組功能才不用重寫
create table public.tenant_line_operators (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants on delete cascade,
  line_user_id  text not null,
  member_id     uuid references public.tenant_members on delete cascade,
  role          text not null default 'staff' check (role in ('admin','staff')),
  bound_at      timestamptz not null default now(),
  unique (tenant_id, line_user_id)
);

-- 群組功能預留（Sprint 8+），現在先建表不做 UI
create table public.tenant_line_groups (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants on delete cascade,
  group_id   text not null unique,
  purpose    text,
  bound_at   timestamptz not null default now(),
  bound_by   uuid references public.tenant_members on delete set null
);

create table public.line_message_logs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants on delete cascade,
  customer_id  uuid references public.customers on delete set null,
  source_type  text not null default 'user' check (source_type in ('user','group','room')),
  source_id    text,
  type         text not null,
  sent_at      timestamptz not null default now(),
  quota_month  text not null
);
comment on column public.line_message_logs.quota_month is
  'YYYY-MM，用來統計 LINE 免費額度（每月 200 則）用量';


-- ═══════════════════════════════════════════════════════════════
-- 9. 時數券與儲值金
--    底層一律以「分鐘」或「金額」記帳，券只是購買面額
-- ═══════════════════════════════════════════════════════════════

create table public.packages (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants on delete cascade,
  name               text not null,
  kind               text not null check (kind in ('minutes','money')),
  default_amount     numeric(10,2) not null,
  default_price      numeric(10,2) not null,
  default_valid_days int,
  is_active          boolean not null default true,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now()
);

create table public.customer_packages (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants on delete cascade,
  customer_id       uuid not null references public.customers on delete cascade,
  package_id        uuid references public.packages on delete set null,
  kind              text not null check (kind in ('minutes','money')),
  paid_amount       numeric(10,2) not null,
  granted_amount    numeric(10,2) not null check (granted_amount > 0),
  remaining_amount  numeric(10,2) not null,
  unit_price        numeric(10,4) generated always as
                    (paid_amount / nullif(granted_amount,0)) stored,
  expires_at        timestamptz,
  status            text not null default 'active'
                    check (status in ('active','used_up','expired','refunded')),
  sold_by           uuid references public.tenant_members on delete set null,
  sold_at           timestamptz not null default now()
);
comment on column public.customer_packages.granted_amount is
  '實得數量，由老師自行決定（收 10,000 給 11 小時就填 11*60）。系統不做贈額規則';
comment on column public.customer_packages.unit_price is
  '實際單價，退款時按已使用比例計算，自然涵蓋贈額情況';

create table public.package_transactions (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants on delete cascade,
  customer_package_id  uuid not null references public.customer_packages on delete cascade,
  booking_id           uuid references public.bookings on delete set null,
  delta                numeric(10,2) not null,
  reason               text,
  created_at           timestamptz not null default now()
);
comment on column public.package_transactions.delta is
  '負數為扣抵，正數為補回（預約取消時）。扣抵順序：先到期的先扣';


-- ═══════════════════════════════════════════════════════════════
-- 10. 設定與訂閱
-- ═══════════════════════════════════════════════════════════════

create table public.tenant_settings (
  tenant_id              uuid primary key references public.tenants on delete cascade,

  -- 定金與退款：只有一個時間門檻，不做完整取消政策引擎
  refundable_hours       int not null default 48,
  deposit_enabled        boolean not null default true,

  -- 放鳥計點與黑名單
  no_show_threshold      numeric(4,2) not null default 3,
  late_cancel_points     numeric(4,2) not null default 0.5,
  no_show_points         numeric(4,2) not null default 1,
  block_window_months    int not null default 12,
  block_duration         text not null default 'permanent'
                         check (block_duration in ('permanent','90d')),
  blocked_message        text not null default '線上預約目前無法使用，請直接與店家聯繫。',

  require_line_friend    boolean not null default false,
  auto_confirm_when_free boolean not null default false,

  updated_at             timestamptz not null default now()
);
comment on column public.tenant_settings.blocked_message is
  '刻意不顯示「你已被列入黑名單」，避免替職人製造正面衝突';

create table public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants on delete cascade,
  plan                    text not null check (plan in ('free','pro')),
  seats                   int not null default 1,
  amount                  numeric(10,2) not null default 0,
  period_start            date,
  period_end              date,
  ecpay_merchant_trade_no text,
  status                  text not null default 'active'
                          check (status in ('active','past_due','cancelled')),
  created_at              timestamptz not null default now()
);


-- ═══════════════════════════════════════════════════════════════
-- 11. 索引
-- ═══════════════════════════════════════════════════════════════

create index on public.tenant_members (user_id);
create index on public.locations (tenant_id);
create index on public.bookables (tenant_id, type) where is_active;
create index on public.services (tenant_id) where is_active;
create index on public.service_requirements (service_id);
create index on public.business_hours (tenant_id, bookable_id, weekday);
create index on public.schedule_exceptions (tenant_id, date);

create index on public.customers (tenant_id, last_visit_at desc nulls last);
create index on public.customers (tenant_id) where is_blocked;
create index on public.customer_notes (customer_id, created_at desc);
create index on public.customer_incidents (tenant_id, customer_id, occurred_at desc);

create index on public.bookings (tenant_id, start_at);
create index on public.bookings (tenant_id, status) where status in ('pending','confirmed');
create index on public.bookings (customer_id, start_at desc);
create index on public.booking_bookables (bookable_id, block_start);

create index on public.payments (tenant_id, booking_id);
create index on public.refund_tasks (tenant_id) where status = 'pending';
create index on public.line_message_logs (tenant_id, quota_month);
create index on public.customer_packages (tenant_id, customer_id)
  where status = 'active';


-- ═══════════════════════════════════════════════════════════════
-- 12. updated_at 觸發器
-- ═══════════════════════════════════════════════════════════════

create trigger t_tenants   before update on public.tenants   for each row execute function public.touch_updated_at();
create trigger t_bookables before update on public.bookables for each row execute function public.touch_updated_at();
create trigger t_services  before update on public.services  for each row execute function public.touch_updated_at();
create trigger t_customers before update on public.customers for each row execute function public.touch_updated_at();
create trigger t_bookings  before update on public.bookings  for each row execute function public.touch_updated_at();
create trigger t_settings  before update on public.tenant_settings for each row execute function public.touch_updated_at();
