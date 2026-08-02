-- ═══════════════════════════════════════════════════════════════
-- Sprint 2 第二批：客人的 LINE 綁定與自動通知
-- 草稿：docs/mockups/line-notifications.html
--
-- LINE 加好友時只給我們一串代號，沒有姓名也沒有電話。要能發通知，
-- 中間一定要有一次把「代號」與「手機號碼」接起來的動作——
-- 做法是歡迎訊息裡那顆預約按鈕帶著加密記號，客人照常預約時就綁好了。
-- ═══════════════════════════════════════════════════════════════

-- ── 客人這一側 ────────────────────────────────────────────────
alter table public.customers
  add column if not exists line_linked_at  timestamptz,
  add column if not exists line_blocked_at timestamptz;

comment on column public.customers.line_linked_at is
  '什麼時候把 LINE 代號接上這位客人的。沒有值就是收不到自動通知';
comment on column public.customers.line_blocked_at is
  '他封鎖了職人的官方帳號。發送時 LINE 會回報，記下來免得職人以為客人收到了';


-- ── 職人這一側 ────────────────────────────────────────────────
alter table public.tenant_settings
  add column if not exists notify_self_on_new_booking boolean not null default true,
  add column if not exists line_welcome_message       text;

comment on column public.tenant_settings.notify_self_on_new_booking is
  '有新預約時也發一則給職人自己。關掉可省下約四分之一的免費額度（他本來就會看後台）';
comment on column public.tenant_settings.line_welcome_message is
  '加好友的第一句話。留空就用系統預設';


-- ── 事前取消（跟「待結案」的事後三選一是兩回事）────────────────
alter table public.bookings
  add column if not exists cancelled_at  timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists cancelled_by  text
    check (cancelled_by is null or cancelled_by in ('tenant', 'customer'));

comment on column public.bookings.cancel_reason is
  '職人自己填的取消原因，只留在後台。發給客人的一律是制式道歉文案（2026-08-02 定案）';


-- ═══════════════════════════════════════════════════════════════
-- 送出預約：補上 LINE 綁定
--
-- 只改兩件事，其餘與 20260730000004 相同：
--   ① 同一組 LINE 代號在同一家店只能掛在一位客人身上（資料表有唯一約束）。
--      客人用第二支手機號碼再約一次時，要先把代號從舊那筆放開，
--      否則整筆預約會因為唯一約束整個失敗——客人只會看到「送出失敗」。
--   ② 記下綁定時間，後台才分得出「沒綁」與「綁過但被封鎖」。
-- ═══════════════════════════════════════════════════════════════

create or replace function public.create_booking(
  p_tenant_id       uuid,
  p_service_id      uuid,
  p_start_at        timestamptz,
  p_bookable_ids    uuid[],
  p_name            text,
  p_phone           text,
  p_location_id     uuid    default null,
  p_duration_min    int     default null,
  p_note            text    default null,
  p_service_address text    default null,
  p_line_user_id    text    default null
)
returns table (booking_id uuid, code text, status text)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_tenant    tenants%rowtype;
  v_service   services%rowtype;
  v_tz        text;
  v_duration  int;
  v_end_at    timestamptz;
  v_phone     text;
  v_name      text;
  v_customer  customers%rowtype;
  v_blocked_message text;
  v_status    text;
  v_price     numeric(10,2);
  v_booking   uuid;
  v_bookable  uuid;
begin
  select * into v_tenant from tenants where id = p_tenant_id and status = 'active';
  if not found then raise exception '找不到這家店' using errcode = 'P0404'; end if;

  select * into v_service from services
   where id = p_service_id and tenant_id = p_tenant_id and is_active;
  if not found then raise exception '這項服務目前沒有開放預約' using errcode = 'P0404'; end if;

  v_tz := coalesce(v_tenant.timezone, 'Asia/Taipei');

  if v_service.duration_mode = 'hourly' then
    v_duration := coalesce(p_duration_min, ceil(coalesce(v_service.min_hours, 1) * 60)::int);
    if v_service.min_hours is not null and v_duration < v_service.min_hours * 60 then
      raise exception '時數低於最少可租時數' using errcode = 'P0400';
    end if;
    if v_service.max_hours is not null and v_duration > v_service.max_hours * 60 then
      raise exception '時數超過最多可租時數' using errcode = 'P0400';
    end if;
  else
    v_duration := v_service.duration_min;
  end if;
  if coalesce(v_duration, 0) <= 0 then
    raise exception '這項服務還沒設定時長' using errcode = 'P0400';
  end if;

  v_end_at := p_start_at + make_interval(mins => v_duration);

  v_name := nullif(btrim(p_name), '');
  if v_name is null then raise exception '請留下你的名字' using errcode = 'P0400'; end if;

  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(v_phone) < 8 then
    raise exception '請填正確的手機號碼' using errcode = 'P0400';
  end if;

  -- ① 這個時段真的還在嗎（含前後銜接與移動時間）
  if not exists (
    select 1 from available_slots(
      p_tenant_id, p_service_id,
      (p_start_at at time zone v_tz)::date,
      p_location_id, v_duration
    ) s
    where s.start_at = p_start_at
  ) then
    raise exception '這個時段剛剛被約走了' using errcode = 'P0409';
  end if;

  -- ★ 同一組 LINE 代號只能掛在一位客人身上。換手機號碼再約一次時，
  --   先從舊那筆放開，不然唯一約束會讓整筆預約掛掉
  if p_line_user_id is not null then
    update customers c
       set line_user_id = null, line_linked_at = null
     where c.tenant_id = p_tenant_id
       and c.line_user_id = p_line_user_id
       and c.phone is distinct from v_phone;
  end if;

  select * into v_customer from customers
   where tenant_id = p_tenant_id and phone = v_phone;

  if found then
    if v_customer.is_blocked
       and (v_customer.blocked_until is null or v_customer.blocked_until > now()) then
      select s.blocked_message into v_blocked_message
        from tenant_settings s where s.tenant_id = p_tenant_id;
      raise exception '%', coalesce(v_blocked_message, '線上預約目前無法使用，請直接與店家聯繫。')
        using errcode = 'P0403';
    end if;

    -- update 的右側取的是舊值，所以能判斷「本來沒綁、現在才綁上」
    update customers
       set name = coalesce(nullif(btrim(name), ''), v_name),
           line_user_id = coalesce(line_user_id, p_line_user_id),
           line_linked_at = case
             when line_user_id is null and p_line_user_id is not null then now()
             else line_linked_at end,
           -- 又從 LINE 進來預約，代表沒封鎖了
           line_blocked_at = case
             when p_line_user_id is not null then null
             else line_blocked_at end
     where id = v_customer.id;
  else
    insert into customers (tenant_id, name, phone, line_user_id, line_linked_at, source)
    values (
      p_tenant_id, v_name, v_phone, p_line_user_id,
      case when p_line_user_id is not null then now() end,
      'online'
    )
    returning * into v_customer;
  end if;

  -- 什麼時候要客人按確認（規格 §4.3，2026-08-02 補上第二個條件）
  --
  --   · 免費方案：沒有任何通知，客人不會知道要確認 → 直接成立
  --   · 開始時間在 24 小時內：直接成立。
  --     「24 小時未確認自動釋出」在這種單上永遠不會觸發——釋出時間會晚於
  --     預約時間，那筆就卡在待確認直到時間過去，變成沒人管的單。
  --     而且確認機制是為了防止客人忘記，明天就要來的預約本來就不會忘。
  --     這種單改成成立後直接發卡片，上面放「我無法前往」讓他反悔得了。
  v_status := case
    when v_tenant.plan = 'free' then 'confirmed'
    when p_start_at < now() + interval '24 hours' then 'confirmed'
    else 'pending'
  end;

  v_price := case
    when v_service.price_unit = 'per_hour' then v_service.price * (v_duration::numeric / 60)
    else v_service.price
  end;

  insert into bookings (
    tenant_id, kind, customer_id, service_id, location_id,
    start_at, end_at, status, source,
    created_by_line_user_id,
    quoted_price, note, service_address,
    confirmed_at
  ) values (
    p_tenant_id, 'booking', v_customer.id, p_service_id, p_location_id,
    p_start_at, v_end_at, v_status, 'online',
    p_line_user_id,
    v_price, nullif(btrim(coalesce(p_note, '')), ''), nullif(btrim(coalesce(p_service_address, '')), ''),
    case when v_status = 'confirmed' then now() end
  )
  returning id into v_booking;

  -- ② 實際佔用。block 區間含服務前後的緩衝，互斥約束會擋掉同時送出的競態
  foreach v_bookable in array p_bookable_ids loop
    if exists (select 1 from bookables b
                where b.id = v_bookable and b.tenant_id = p_tenant_id and b.is_active) then
      insert into booking_bookables (booking_id, bookable_id, block_start, block_end)
      values (
        v_booking, v_bookable,
        p_start_at - make_interval(mins => v_service.buffer_before_min),
        v_end_at + make_interval(mins => v_service.buffer_after_min)
      );
    end if;
  end loop;

  return query
    select v_booking,
           upper(substr(replace(v_booking::text, '-', ''), 1, 6)),
           v_status;
end $$;

revoke all on function public.create_booking(
  uuid, uuid, timestamptz, uuid[], text, text, uuid, int, text, text, text
) from public;
grant execute on function public.create_booking(
  uuid, uuid, timestamptz, uuid[], text, text, uuid, int, text, text, text
) to anon, authenticated;


-- ═══════════════════════════════════════════════════════════════
-- 事前取消
--
-- 跟 close_booking 的差別：那支處理「時間已經過了」的三選一，
-- 這支處理「還沒發生就不做了」——時段要放回去讓別人約得到。
--
-- 兩個入口共用同一支，計點規則才不會有兩套：
--   · 職人取消：不計點（規格 §5.3 反而是職人該賠）
--   · 客人取消：在 refundable_hours 內算臨時取消，計 0.5 點（§6.1），
--     累計到門檻一樣自動封鎖（§6.2）
--
-- 客人那條路是 webhook 收到 LINE 按鈕後用 service role 呼叫的，
-- 那時候沒有登入身分，所以改用 LINE 代號驗身份。
-- ═══════════════════════════════════════════════════════════════

create or replace function public.cancel_booking(
  p_booking_id   uuid,
  p_actor        text,                -- tenant | customer
  p_reason       text default null,
  p_line_user_id text default null
)
returns table (status text, late boolean)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_booking  bookings%rowtype;
  v_member   tenant_members%rowtype;
  v_settings tenant_settings%rowtype;
  v_customer customers%rowtype;
  v_late     boolean;
  v_status   text;
  v_points   numeric;
  v_total    numeric;
begin
  select b.* into v_booking from bookings b where b.id = p_booking_id;
  if not found then raise exception '找不到這筆預約' using errcode = 'P0404'; end if;

  if p_actor not in ('tenant', 'customer') then
    raise exception '不正確的取消來源' using errcode = 'P0400';
  end if;

  if v_booking.status not in ('pending', 'confirmed') then
    raise exception '這筆預約已經不是待確認或已確認的狀態了' using errcode = 'P0400';
  end if;

  if v_booking.start_at <= now() then
    raise exception '這筆預約的時間已經開始了，請用結案處理' using errcode = 'P0400';
  end if;

  select s.* into v_settings from tenant_settings s
   where s.tenant_id = v_booking.tenant_id;

  if p_actor = 'tenant' then
    select m.* into v_member from tenant_members m
     where m.tenant_id = v_booking.tenant_id and m.user_id = auth.uid();
    if not found then raise exception '沒有權限' using errcode = 'P0403'; end if;

    v_late   := false;
    v_status := 'cancelled';
  else
    if p_line_user_id is null then
      raise exception '沒有權限' using errcode = 'P0403';
    end if;
    select c.* into v_customer from customers c
     where c.id = v_booking.customer_id and c.line_user_id = p_line_user_id;
    if not found then raise exception '沒有權限' using errcode = 'P0403'; end if;

    -- 臨時取消與放鳥共用同一個時間門檻，職人只要理解一個數字（規格 §6.1）
    v_late := v_booking.start_at
              < now() + make_interval(hours => coalesce(v_settings.refundable_hours, 48));
    v_status := case when v_late then 'cancelled_late' else 'cancelled' end;
  end if;

  update bookings b
     set status = v_status,
         cancelled_at = now(),
         cancelled_by = p_actor,
         cancel_reason = nullif(btrim(coalesce(p_reason, '')), ''),
         closed_at = now(),
         closed_by = v_member.id
   where b.id = p_booking_id;

  -- 狀態一改，booking_bookables 的觸發器就把佔用放掉，時段自動回到可約

  if v_late and v_booking.customer_id is not null then
    v_points := coalesce(v_settings.late_cancel_points, 0.5);

    insert into customer_incidents (tenant_id, customer_id, booking_id, type, points)
    values (v_booking.tenant_id, v_booking.customer_id, p_booking_id, 'late_cancel', v_points);

    select coalesce(sum(i.points), 0) into v_total
      from customer_incidents i
     where i.customer_id = v_booking.customer_id
       and i.occurred_at > now()
           - make_interval(months => coalesce(v_settings.block_window_months, 12));

    update customers c set no_show_points = v_total where c.id = v_booking.customer_id;

    select c.* into v_customer from customers c where c.id = v_booking.customer_id;

    if not v_customer.is_exempt
       and not v_customer.is_blocked
       and v_total >= coalesce(v_settings.no_show_threshold, 3) then
      update customers c
         set is_blocked = true,
             blocked_at = now(),
             blocked_until = case
               when coalesce(v_settings.block_duration, 'permanent') = '90d'
               then now() + interval '90 days' end,
             blocked_reason = '累計放鳥點數達到上限'
       where c.id = v_customer.id;

      insert into blocklist_logs
        (tenant_id, customer_id, action, is_auto, reason, points_at_time)
      values
        (v_booking.tenant_id, v_customer.id, 'block', true,
         '自動封鎖：累計點數達到上限', v_total);
    end if;
  end if;

  return query select v_status, v_late;
end $$;

revoke all on function public.cancel_booking(uuid, text, text, text) from public;
grant execute on function public.cancel_booking(uuid, text, text, text) to authenticated, service_role;


-- ═══════════════════════════════════════════════════════════════
-- 客人在 LINE 按下「確認預約」
--
-- 同樣走 service role，所以用 LINE 代號驗身份而不是 auth.uid()。
-- ═══════════════════════════════════════════════════════════════

create or replace function public.confirm_booking_by_line(
  p_booking_id   uuid,
  p_line_user_id text
)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
begin
  select b.* into v_booking from bookings b where b.id = p_booking_id;
  if not found then raise exception '找不到這筆預約' using errcode = 'P0404'; end if;

  if not exists (
    select 1 from customers c
     where c.id = v_booking.customer_id and c.line_user_id = p_line_user_id
  ) then
    raise exception '沒有權限' using errcode = 'P0403';
  end if;

  -- 已經確認過就安靜地回同一個答案：客人多按一次不該看到錯誤訊息
  if v_booking.status = 'confirmed' then return 'confirmed'; end if;
  if v_booking.status <> 'pending' then
    raise exception '這筆預約已經不能確認了' using errcode = 'P0400';
  end if;

  update bookings b
     set status = 'confirmed', confirmed_at = now()
   where b.id = p_booking_id;

  return 'confirmed';
end $$;

revoke all on function public.confirm_booking_by_line(uuid, text) from public;
grant execute on function public.confirm_booking_by_line(uuid, text) to service_role;
