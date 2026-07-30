-- ═══════════════════════════════════════════════════════════════
-- 手動建立預約 + 結案
--
-- 這兩件事都要一次動好幾張表，中間失敗不能留下半筆資料，
-- 所以包成函式而不是在應用層打三次 API。
-- ═══════════════════════════════════════════════════════════════


-- ── 手動建立預約（老師接電話當下就要能登記，規格 §4.4）─────────
--
-- 與線上預約的三個差別：
--   1. 不受 30 分鐘格點限制，老師可以填任意時間（規格 §8.7）
--   2. 不擋黑名單——要不要接這個客人是老師自己的判斷
--   3. 一律直接確認，不走 pending
--
-- 「時段來不及移動」只警告不擋（由前端問過老師），但「資源已被佔用」
-- 仍然由資料庫的互斥約束硬擋——同一間包廂不可能塞兩組客人。
create or replace function public.create_manual_booking(
  p_tenant_id     uuid,
  p_service_id    uuid,
  p_start_at      timestamptz,
  p_customer_id   uuid    default null,
  p_name          text    default null,
  p_phone         text    default null,
  p_bookable_ids  uuid[]  default null,
  p_location_id   uuid    default null,
  p_duration_min  int     default null,
  p_note          text    default null,
  p_internal_note text    default null
)
returns table (booking_id uuid, code text, status text)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_member    tenant_members%rowtype;
  v_service   services%rowtype;
  v_customer  customers%rowtype;
  v_duration  int;
  v_end_at    timestamptz;
  v_block_start timestamptz;
  v_block_end   timestamptz;
  v_phone     text;
  v_name      text;
  v_price     numeric(10,2);
  v_ids       uuid[] := '{}';
  v_req       record;
  v_pick      uuid;
  v_booking   uuid;
  v_bookable  uuid;
begin
  select m.* into v_member from tenant_members m
   where m.tenant_id = p_tenant_id and m.user_id = auth.uid();
  if not found then raise exception '沒有權限' using errcode = 'P0403'; end if;

  select sv.* into v_service from services sv
   where sv.id = p_service_id and sv.tenant_id = p_tenant_id;
  if not found then raise exception '找不到這項服務' using errcode = 'P0404'; end if;

  v_duration := case
    when v_service.duration_mode = 'hourly'
      then coalesce(p_duration_min, ceil(coalesce(v_service.min_hours, 1) * 60)::int)
    else coalesce(p_duration_min, v_service.duration_min)
  end;
  if coalesce(v_duration, 0) <= 0 then
    raise exception '請填服務時長' using errcode = 'P0400';
  end if;

  v_end_at      := p_start_at + make_interval(mins => v_duration);
  v_block_start := p_start_at - make_interval(mins => v_service.buffer_before_min);
  v_block_end   := v_end_at + make_interval(mins => v_service.buffer_after_min);

  -- 客人：選既有的，或用手機號碼認人／新建
  if p_customer_id is not null then
    select c.* into v_customer from customers c
     where c.id = p_customer_id and c.tenant_id = p_tenant_id;
    if not found then raise exception '找不到這位客人' using errcode = 'P0404'; end if;
  else
    v_name := nullif(btrim(coalesce(p_name, '')), '');
    if v_name is null then raise exception '請填客人名字' using errcode = 'P0400'; end if;
    v_phone := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');

    if v_phone is not null then
      select c.* into v_customer from customers c
       where c.tenant_id = p_tenant_id and c.phone = v_phone;
    end if;

    if v_customer.id is null then
      insert into customers (tenant_id, name, phone, source)
      values (p_tenant_id, v_name, v_phone, 'manual')
      returning * into v_customer;
    end if;
  end if;

  -- 佔用哪些標的：前端有指定就用它的，否則照服務需求自己挑空的
  if p_bookable_ids is not null and array_length(p_bookable_ids, 1) > 0 then
    v_ids := p_bookable_ids;
  else
    for v_req in
      select r.* from service_requirements r where r.service_id = p_service_id
    loop
      v_pick := null;
      select b.id into v_pick from bookables b
       where b.tenant_id = p_tenant_id and b.is_active
         and case when v_req.bookable_id is not null
                  then b.id = v_req.bookable_id else b.type = v_req.bookable_type end
         and not (b.id = any(v_ids))
         and not exists (
           select 1 from booking_bookables bb
            where bb.bookable_id = b.id and bb.is_active
              and tstzrange(bb.block_start, bb.block_end, '[)')
               && tstzrange(v_block_start, v_block_end, '[)'))
       order by b.sort_order, b.id
       limit 1;

      -- 全都被佔住時仍取第一個，讓互斥約束去擋，
      -- 老師才會看到「這個時段已經被佔用」而不是「找不到資源」
      if v_pick is null then
        select b.id into v_pick from bookables b
         where b.tenant_id = p_tenant_id and b.is_active
           and case when v_req.bookable_id is not null
                    then b.id = v_req.bookable_id else b.type = v_req.bookable_type end
         order by b.sort_order, b.id
         limit 1;
      end if;

      if v_pick is null then
        raise exception '這項服務還沒設定要佔用哪些資源' using errcode = 'P0400';
      end if;
      v_ids := v_ids || v_pick;
    end loop;
  end if;

  if array_length(v_ids, 1) is null then
    raise exception '這項服務還沒設定要佔用哪些資源' using errcode = 'P0400';
  end if;

  v_price := case
    when v_service.price_unit = 'per_hour' then v_service.price * (v_duration::numeric / 60)
    else v_service.price
  end;

  insert into bookings (
    tenant_id, kind, customer_id, service_id, location_id,
    start_at, end_at, status, source,
    quoted_price, note, internal_note,
    created_by_member_id, confirmed_by, confirmed_at
  ) values (
    p_tenant_id, 'booking', v_customer.id, p_service_id, p_location_id,
    p_start_at, v_end_at, 'confirmed', 'manual',
    v_price,
    nullif(btrim(coalesce(p_note, '')), ''),
    nullif(btrim(coalesce(p_internal_note, '')), ''),
    v_member.id, v_member.id, now()
  )
  returning bookings.id into v_booking;

  foreach v_bookable in array v_ids loop
    insert into booking_bookables (booking_id, bookable_id, block_start, block_end)
    values (v_booking, v_bookable, v_block_start, v_block_end);
  end loop;

  return query
    select v_booking,
           upper(substr(replace(v_booking::text, '-', ''), 1, 6)),
           'confirmed'::text;
end $$;

revoke all on function public.create_manual_booking(
  uuid, uuid, timestamptz, uuid, text, text, uuid[], uuid, int, text, text
) from public;
grant execute on function public.create_manual_booking(
  uuid, uuid, timestamptz, uuid, text, text, uuid[], uuid, int, text, text
) to authenticated;


-- ── 結案（規格 §4.2）─────────────────────────────────────────
--
-- 預約時間過了兩小時還停在 confirmed 就要老師三選一：
-- 有來結帳 / 沒出現 / 取消不計。刻意不自動判定放鳥——
-- 誤判一次可能得罪一個好客人。
--
-- 沒有這一步就沒有營收報表：現場付款沒有線上金流，
-- 所有數字都來自這裡登記的實收金額。
create or replace function public.close_booking(
  p_booking_id     uuid,
  p_outcome        text,              -- completed | no_show | cancelled
  p_actual_amount  numeric default null,
  p_payment_method text    default null,
  p_internal_note  text    default null
)
returns text
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
  v_points   numeric;
  v_total    numeric;
  v_amount   numeric;
begin
  select b.* into v_booking from bookings b where b.id = p_booking_id;
  if not found then raise exception '找不到這筆預約' using errcode = 'P0404'; end if;

  select m.* into v_member from tenant_members m
   where m.tenant_id = v_booking.tenant_id and m.user_id = auth.uid();
  if not found then raise exception '沒有權限' using errcode = 'P0403'; end if;

  if p_outcome not in ('completed', 'no_show', 'cancelled') then
    raise exception '不正確的結案方式' using errcode = 'P0400';
  end if;

  select s.* into v_settings from tenant_settings s
   where s.tenant_id = v_booking.tenant_id;

  if p_outcome = 'completed' then
    v_amount := coalesce(p_actual_amount, v_booking.quoted_price, 0);

    update bookings b
       set status = 'completed',
           actual_amount = v_amount,
           payment_method = p_payment_method,
           internal_note = coalesce(nullif(btrim(coalesce(p_internal_note, '')), ''), b.internal_note),
           closed_at = now(),
           closed_by = v_member.id
     where b.id = p_booking_id;

    if v_booking.customer_id is not null then
      update customers c
         set visit_count = c.visit_count + 1,
             total_spent = c.total_spent + v_amount,
             last_visit_at = greatest(coalesce(c.last_visit_at, v_booking.end_at), v_booking.end_at),
             first_visit_at = coalesce(c.first_visit_at, v_booking.start_at)
       where c.id = v_booking.customer_id;
    end if;

  elsif p_outcome = 'no_show' then
    update bookings b
       set status = 'no_show',
           internal_note = coalesce(nullif(btrim(coalesce(p_internal_note, '')), ''), b.internal_note),
           closed_at = now(),
           closed_by = v_member.id
     where b.id = p_booking_id;

    if v_booking.customer_id is not null then
      v_points := coalesce(v_settings.no_show_points, 1);

      insert into customer_incidents (tenant_id, customer_id, booking_id, type, points)
      values (v_booking.tenant_id, v_booking.customer_id, p_booking_id, 'no_show', v_points);

      -- 點數採滾動期間累計，久遠的紀錄自然淡出（規格 §6.2）
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
          (tenant_id, customer_id, action, is_auto, reason, points_at_time, actor_id)
        values
          (v_booking.tenant_id, v_customer.id, 'block', true,
           '自動封鎖：累計點數達到上限', v_total, v_member.id);
      end if;
    end if;

  else
    -- 取消不計：不留點數、不進黑名單
    update bookings b
       set status = 'cancelled',
           internal_note = coalesce(nullif(btrim(coalesce(p_internal_note, '')), ''), b.internal_note),
           closed_at = now(),
           closed_by = v_member.id
     where b.id = p_booking_id;
  end if;

  return p_outcome;
end $$;

revoke all on function public.close_booking(uuid, text, numeric, text, text) from public;
grant execute on function public.close_booking(uuid, text, numeric, text, text) to authenticated;
