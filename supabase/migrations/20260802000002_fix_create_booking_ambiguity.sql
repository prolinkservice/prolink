-- ═══════════════════════════════════════════════════════════════
-- 再修一次 create_booking 的欄位撞名
--
-- ⚠️ 這個坑在 20260730000004 就修過一次，20260802000001 又踩回去了。
--
-- 原因：回傳欄位裡有一個叫 status，函式內只要出現沒加前綴的 status，
-- PostgreSQL 就分不出是回傳變數還是資料表欄位，整支直接爆
-- （42702 column reference "status" is ambiguous）。
-- 客人端的症狀是「填完資料送出後又被丟回選項目的畫面」，
-- 因為送出失敗，前端把人退回上一步。
--
-- 規矩：**這支函式裡每一個資料表欄位都必須帶別名前綴**，
-- 即使那個欄位現在看起來不會撞名。下次要改這支，先看這段。
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
  select t.* into v_tenant from tenants t
   where t.id = p_tenant_id and t.status = 'active';
  if not found then raise exception '找不到這家店' using errcode = 'P0404'; end if;

  select sv.* into v_service from services sv
   where sv.id = p_service_id and sv.tenant_id = p_tenant_id and sv.is_active;
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

  -- ★ 同一組 LINE 代號只能掛在一位客人身上（資料表有唯一約束）。
  --   客人換一支手機號碼再約一次時，要先從舊那筆放開，
  --   否則唯一約束會讓整筆預約失敗，客人只看到「送出失敗」
  if p_line_user_id is not null then
    update customers c
       set line_user_id = null, line_linked_at = null
     where c.tenant_id = p_tenant_id
       and c.line_user_id = p_line_user_id
       and c.phone is distinct from v_phone;
  end if;

  select c.* into v_customer from customers c
   where c.tenant_id = p_tenant_id and c.phone = v_phone;

  if found then
    -- 封鎖的客人擋在送出這一步，不在進頁面時就擋，
    -- 避免被試探出規則。文案一律不提黑名單（規格 §6.3）
    if v_customer.is_blocked
       and (v_customer.blocked_until is null or v_customer.blocked_until > now()) then
      select ts.blocked_message into v_blocked_message
        from tenant_settings ts where ts.tenant_id = p_tenant_id;
      raise exception '%', coalesce(v_blocked_message, '線上預約目前無法使用，請直接與店家聯繫。')
        using errcode = 'P0403';
    end if;

    -- update 的右側取的是舊值，所以判斷得出「本來沒綁、現在才綁上」
    update customers c
       set name = coalesce(nullif(btrim(c.name), ''), v_name),
           line_user_id = coalesce(c.line_user_id, p_line_user_id),
           line_linked_at = case
             when c.line_user_id is null and p_line_user_id is not null then now()
             else c.line_linked_at end,
           -- 又從 LINE 進來預約，代表沒封鎖了
           line_blocked_at = case
             when p_line_user_id is not null then null
             else c.line_blocked_at end
     where c.id = v_customer.id;
  else
    insert into customers (tenant_id, name, phone, line_user_id, line_linked_at, source)
    values (
      p_tenant_id, v_name, v_phone, p_line_user_id,
      case when p_line_user_id is not null then now() end,
      'online'
    )
    returning * into v_customer;
  end if;

  -- 什麼時候要客人按確認（規格 §4.3）
  --
  --   · 免費方案：沒有任何通知，客人不會知道要確認 → 直接成立
  --   · 開始時間在 24 小時內：直接成立。
  --     「24 小時未確認自動釋出」在這種單上永遠不會觸發——釋出時間會晚於
  --     預約時間，那筆就卡在待確認直到時間過去，變成沒人管的單。
  --     而且確認機制是為了防止客人忘記，明天就要來的預約本來就不會忘。
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
  returning bookings.id into v_booking;

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
