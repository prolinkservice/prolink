-- ═══════════════════════════════════════════════════════════════
-- 線上預約：店家聯絡方式 + 送出預約
-- ═══════════════════════════════════════════════════════════════

-- ── 客人找得到店家的兩個欄位 ──────────────────────────────────
-- 放在 tenants 而不是 tenant_settings，因為客人（匿名）要讀得到，
-- 而 tenant_settings 整張表只有租戶成員看得見。
alter table public.tenants
  add column if not exists line_friend_url text,
  add column if not exists contact_phone   text;

comment on column public.tenants.line_friend_url is
  'LINE 官方帳號的加好友連結。免費方案沒有自動通知，這是客人唯一找得到職人的地方';


-- ═══════════════════════════════════════════════════════════════
-- 送出預約
--
-- 為什麼要用函式：這一步要一次做完「認客人 → 擋黑名單 → 建預約 →
-- 佔用標的」，中間任一步失敗都不能留下半筆資料。而且客人是匿名的，
-- 沒有任何一張表能開放給他寫。
--
-- 防重複預約有兩道：
--   ① 重新問一次引擎，確定這個時段真的還在（含移動時間銜接）
--   ② booking_bookables 的互斥約束，資料庫層擋掉同時送出的競態
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

  -- 手機號碼是這個系統認人的方式，只留數字，避免 0912-345-678 與
  -- 0912345678 被當成兩個人
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

  select * into v_customer from customers
   where tenant_id = p_tenant_id and phone = v_phone;

  if found then
    -- 封鎖的客人擋在送出這一步，不在進頁面時就擋，
    -- 避免被試探出規則。文案一律不提黑名單（規格 §6.3）
    if v_customer.is_blocked
       and (v_customer.blocked_until is null or v_customer.blocked_until > now()) then
      select s.blocked_message into v_blocked_message
        from tenant_settings s where s.tenant_id = p_tenant_id;
      raise exception '%', coalesce(v_blocked_message, '線上預約目前無法使用，請直接與店家聯繫。')
        using errcode = 'P0403';
    end if;

    update customers
       set name = coalesce(nullif(btrim(name), ''), v_name),
           line_user_id = coalesce(line_user_id, p_line_user_id)
     where id = v_customer.id;
  else
    insert into customers (tenant_id, name, phone, line_user_id, source)
    values (p_tenant_id, v_name, v_phone, p_line_user_id, 'online')
    returning * into v_customer;
  end if;

  -- 免費方案沒有任何通知，客人不會知道要確認，所以直接成立；
  -- 付費方案才走 pending → 發通知請客人確認（規格 §4.3）
  v_status := case when v_tenant.plan = 'free' then 'confirmed' else 'pending' end;

  v_price := case
    when v_service.price_unit = 'per_hour' then v_service.price * (v_duration::numeric / 60)
    else v_service.price
  end;

  insert into bookings (
    tenant_id, kind, customer_id, service_id, location_id,
    start_at, end_at, status, source,
    quoted_price, note, service_address,
    confirmed_at
  ) values (
    p_tenant_id, 'booking', v_customer.id, p_service_id, p_location_id,
    p_start_at, v_end_at, v_status, 'online',
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
