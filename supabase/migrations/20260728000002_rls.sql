-- ═══════════════════════════════════════════════════════════════
-- ProLink · Sprint 0 資料列權限（RLS）
--
-- 隔離原則：一律以 tenant_id 為邊界，無例外。
-- 一次跨租戶洩漏，產品就沒了。
-- ═══════════════════════════════════════════════════════════════

-- security definer 讓這個函式本身不受 RLS 影響，
-- 否則 tenant_members 的政策會遞迴呼叫自己
create or replace function public.current_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.tenant_members where user_id = auth.uid()
$$;

revoke all on function public.current_tenant_ids() from public;
grant execute on function public.current_tenant_ids() to authenticated;


-- ── 全表開啟 RLS ────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'tenants','tenant_slug_history','tenant_members','locations','location_travel_times',
    'bookables','services','service_requirements','business_hours','schedule_exceptions',
    'customers','customer_tags','customer_tag_map','customer_notes',
    'customer_incidents','blocklist_logs',
    'booking_series','bookings','booking_bookables',
    'tenant_payment_accounts','payments','refund_tasks',
    'tenant_line_channels','tenant_line_operators','tenant_line_groups','line_message_logs',
    'packages','customer_packages','package_transactions',
    'tenant_settings','subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;


-- ── 租戶成員的通用政策 ──────────────────────────────────────
-- 帶 tenant_id 的表一律套用同一條規則
do $$
declare t text;
begin
  foreach t in array array[
    'tenant_slug_history','locations','location_travel_times',
    'bookables','services','business_hours','schedule_exceptions',
    'customers','customer_tags','customer_notes',
    'customer_incidents','blocklist_logs',
    'booking_series','bookings',
    'tenant_payment_accounts','payments','refund_tasks',
    'tenant_line_channels','tenant_line_operators','tenant_line_groups','line_message_logs',
    'packages','customer_packages','package_transactions',
    'tenant_settings','subscriptions'
  ] loop
    execute format($f$
      create policy member_all on public.%I
        for all to authenticated
        using (tenant_id in (select public.current_tenant_ids()))
        with check (tenant_id in (select public.current_tenant_ids()))
    $f$, t);
  end loop;
end $$;


-- ── 沒有 tenant_id 欄位的表，改走父表判斷 ───────────────────

create policy member_all on public.service_requirements
  for all to authenticated
  using (exists (
    select 1 from public.services s
     where s.id = service_id
       and s.tenant_id in (select public.current_tenant_ids())))
  with check (exists (
    select 1 from public.services s
     where s.id = service_id
       and s.tenant_id in (select public.current_tenant_ids())));

create policy member_all on public.customer_tag_map
  for all to authenticated
  using (exists (
    select 1 from public.customers c
     where c.id = customer_id
       and c.tenant_id in (select public.current_tenant_ids())))
  with check (exists (
    select 1 from public.customers c
     where c.id = customer_id
       and c.tenant_id in (select public.current_tenant_ids())));

create policy member_all on public.booking_bookables
  for all to authenticated
  using (exists (
    select 1 from public.bookings b
     where b.id = booking_id
       and b.tenant_id in (select public.current_tenant_ids())))
  with check (exists (
    select 1 from public.bookings b
     where b.id = booking_id
       and b.tenant_id in (select public.current_tenant_ids())));


-- ── tenants 與 tenant_members ───────────────────────────────

create policy member_read on public.tenants
  for select to authenticated
  using (id in (select public.current_tenant_ids()));

create policy owner_update on public.tenants
  for update to authenticated
  using (exists (
    select 1 from public.tenant_members m
     where m.tenant_id = tenants.id
       and m.user_id = auth.uid()
       and m.role in ('owner','manager')));

-- 建立租戶：任何登入者都能開自己的工作室（自助註冊，不需審核）
create policy self_create on public.tenants
  for insert to authenticated with check (true);

create policy member_read on public.tenant_members
  for select to authenticated
  using (user_id = auth.uid() or tenant_id in (select public.current_tenant_ids()));

create policy owner_manage on public.tenant_members
  for all to authenticated
  using (exists (
    select 1 from public.tenant_members m
     where m.tenant_id = tenant_members.tenant_id
       and m.user_id = auth.uid()
       and m.role = 'owner'))
  with check (exists (
    select 1 from public.tenant_members m
     where m.tenant_id = tenant_members.tenant_id
       and m.user_id = auth.uid()
       and m.role = 'owner'));


-- ═══════════════════════════════════════════════════════════════
-- 公開預約頁（/p/{slug}）需要的匿名讀取
--
-- 只開放「客人本來就看得到」的資料：店家基本資料、服務項目、
-- 據點、營業時間。
--
-- ★ bookings 與 customers 一律不開放匿名讀取。
--   可預約時段必須透過 RPC 計算後只回傳「空檔」，
--   絕不能讓外部從預約資料反推出客人是誰、幾點來過。
-- ═══════════════════════════════════════════════════════════════

create policy public_read on public.tenants
  for select to anon
  using (status = 'active');

create policy public_read on public.locations
  for select to anon using (is_active);

create policy public_read on public.bookables
  for select to anon using (is_active);

create policy public_read on public.services
  for select to anon using (is_active);

create policy public_read on public.service_requirements
  for select to anon
  using (exists (select 1 from public.services s
                  where s.id = service_id and s.is_active));

create policy public_read on public.business_hours
  for select to anon using (true);

create policy public_read on public.schedule_exceptions
  for select to anon using (true);


-- ═══════════════════════════════════════════════════════════════
-- 可預約時段計算（骨架）
--
-- Sprint 1 補完內容。四層過濾：
--   1. 標的在該時段是否有排班（business_hours）
--   2. 該排班是否在客人選的地點（location_id）
--   3. 是否與既有預約衝突（含情境式 buffer 與跨點移動時間）
--   4. 是否在服務區域內（mobile 模式）
--
-- 用 security definer 讓匿名使用者能查空檔，
-- 但只回傳時間，不回傳任何預約或客人資料。
-- ═══════════════════════════════════════════════════════════════

create or replace function public.available_slots(
  p_tenant_id   uuid,
  p_service_id  uuid,
  p_date        date,
  p_location_id uuid default null
)
returns table (start_at timestamptz, end_at timestamptz, bookable_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- TODO(Sprint 1)：實作四層過濾
  return;
end $$;

revoke all on function public.available_slots(uuid,uuid,date,uuid) from public;
grant execute on function public.available_slots(uuid,uuid,date,uuid) to anon, authenticated;
