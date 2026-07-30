-- ═══════════════════════════════════════════════════════════════
-- 可預約時段引擎
--
-- 客人看到的每一個時段都要通過三項檢查（規格 §8.6）：
--   1. 從上一筆預約的地點趕得過來
--   2. 做完之後趕得去下一筆的地點      ← 只往前看會放下一位客人鴿子
--   3. 時段本身沒被佔用
--
-- 另外兩條規矩：
--   · 起始時間一律對齊 :00 / :30，零頭無條件進位（§8.7）
--   · 間隔用相加不取大值：收拾完才能上路，到了還要準備（§8.4）
--
-- security definer：匿名客人要查得到空檔，但只回傳時間，
-- 不回傳任何預約或客人資料。
-- ═══════════════════════════════════════════════════════════════


-- ── 兩點之間要開多久 ──────────────────────────────────────────
create or replace function public.travel_minutes(
  p_bookable_id   uuid,
  p_from_location uuid,
  p_to_location   uuid
) returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant       uuid;
  v_cross        int;
  v_default      int;
  v_from_mobile  boolean := false;
  v_to_mobile    boolean := false;
  v_minutes      int;
begin
  select tenant_id, cross_site_travel_min, default_travel_min
    into v_tenant, v_cross, v_default
    from bookables where id = p_bookable_id;
  if not found then return 0; end if;

  if p_from_location is not null then
    select (type = 'mobile') into v_from_mobile from locations where id = p_from_location;
  end if;
  if p_to_location is not null then
    select (type = 'mobile') into v_to_mobile from locations where id = p_to_location;
  end if;

  -- 到府沒有固定地點，車程算不準，一律用預留值
  if coalesce(v_from_mobile, false) or coalesce(v_to_mobile, false) then
    return coalesce(v_default, 30);
  end if;

  -- 同一個地點不計移動。單店老師兩邊都是 null，同樣落在這裡
  if p_from_location is not distinct from p_to_location then return 0; end if;

  -- 只有一邊指定地點，查不到對應值，用跨點預設
  if p_from_location is null or p_to_location is null then
    return coalesce(v_cross, 30);
  end if;

  select minutes into v_minutes
    from location_travel_times
   where tenant_id = v_tenant
     and from_location_id = p_from_location
     and to_location_id = p_to_location;

  return coalesce(v_minutes, v_cross, 30);
end $$;

revoke all on function public.travel_minutes(uuid, uuid, uuid) from public;
grant execute on function public.travel_minutes(uuid, uuid, uuid) to anon, authenticated;


-- ── 可預約時段 ────────────────────────────────────────────────
-- Sprint 0 的骨架回傳單一 bookable_id，但一筆預約可能同時佔用
-- 師傅＋包廂，所以改回傳整組 id。
drop function if exists public.available_slots(uuid, uuid, date, uuid);

create or replace function public.available_slots(
  p_tenant_id    uuid,
  p_service_id   uuid,
  p_date         date,
  p_location_id  uuid default null,
  p_duration_min int  default null   -- 場租由客人選時數時填
)
returns table (
  start_at     timestamptz,
  end_at       timestamptz,
  location_id  uuid,
  bookable_ids uuid[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_service      services%rowtype;
  v_tz           text;
  v_duration     int;
  v_weekday      int;
  v_now          timestamptz := now();
  v_want_loc     uuid;
  v_anchor_req   record;
  v_anchor       uuid;
  v_has_exc      boolean;
  v_exc          record;
  v_window       record;
  v_req          record;
  v_prev         record;
  v_next         record;
  v_local_start  timestamp;
  v_local_end    timestamp;
  v_ts           timestamp;
  v_slot_start   timestamptz;
  v_slot_end     timestamptz;
  v_block_start  timestamptz;
  v_block_end    timestamptz;
  v_ok           boolean;
  v_ids          uuid[];
  v_extra        uuid;
begin
  select * into v_service
    from services
   where id = p_service_id and tenant_id = p_tenant_id and is_active;
  if not found then return; end if;

  -- 團課（capacity > 1）要改用席次加總判斷，不走互斥那條路（Sprint 8）
  if v_service.capacity > 1 then return; end if;

  if v_service.duration_mode = 'hourly' then
    v_duration := coalesce(p_duration_min, ceil(coalesce(v_service.min_hours, 1) * 60)::int);
    if v_service.min_hours is not null and v_duration < v_service.min_hours * 60 then return; end if;
    if v_service.max_hours is not null and v_duration > v_service.max_hours * 60 then return; end if;
  else
    v_duration := v_service.duration_min;
  end if;
  if coalesce(v_duration, 0) <= 0 then return; end if;

  select t.timezone into v_tz from tenants t where t.id = p_tenant_id;
  v_tz := coalesce(v_tz, 'Asia/Taipei');
  v_weekday := extract(dow from p_date)::int;

  -- 服務綁死在某個據點時，客人沒得選，直接以它為準
  v_want_loc := coalesce(
    p_location_id,
    case when v_service.location_mode = 'fixed' then v_service.location_id end
  );

  -- 主標的：有人就以人為準，因為只有人會跑來跑去；純場租取場地
  select * into v_anchor_req
    from service_requirements
   where service_id = p_service_id
   order by (bookable_type = 'staff') desc, id
   limit 1;
  if not found then return; end if;

  for v_anchor in
    select b.id
      from bookables b
     where b.tenant_id = p_tenant_id
       and b.is_active
       and case when v_anchor_req.bookable_id is not null
                then b.id = v_anchor_req.bookable_id
                else b.type = v_anchor_req.bookable_type end
     order by b.sort_order, b.id
  loop
    -- 當天的例外。指定到標的的優先於整店的
    select * into v_exc
      from schedule_exceptions e
     where e.tenant_id = p_tenant_id
       and e.date = p_date
       and (e.bookable_id = v_anchor or e.bookable_id is null)
     order by (e.bookable_id is not null) desc
     limit 1;
    v_has_exc := found;

    if v_has_exc and v_exc.is_closed then continue; end if;

    for v_window in
      select h.location_id as loc, h.start_time, h.end_time
        from business_hours h
       where h.tenant_id = p_tenant_id
         and h.bookable_id = v_anchor
         and h.weekday = v_weekday
         and (v_want_loc is null or h.location_id is null or h.location_id = v_want_loc)
       order by h.start_time
    loop
      v_local_start := p_date + v_window.start_time;
      v_local_end   := p_date + v_window.end_time;

      -- 例外有指定時間就把當天的班夾進那個範圍
      if v_has_exc and v_exc.start_time is not null then
        v_local_start := greatest(v_local_start, p_date + v_exc.start_time);
        v_local_end := least(v_local_end, p_date + coalesce(v_exc.end_time, v_window.end_time));
      end if;

      -- 起始時間對齊 :00 / :30，零頭無條件進位
      v_ts := date_trunc('hour', v_local_start) + case
                when extract(minute from v_local_start) = 0  then interval '0 minute'
                when extract(minute from v_local_start) <= 30 then interval '30 minute'
                else interval '60 minute'
              end;

      while v_ts + make_interval(mins => v_duration) <= v_local_end loop
        v_slot_start  := v_ts at time zone v_tz;
        v_slot_end    := (v_ts + make_interval(mins => v_duration)) at time zone v_tz;
        v_block_start := v_slot_start - make_interval(mins => v_service.buffer_before_min);
        v_block_end   := v_slot_end + make_interval(mins => v_service.buffer_after_min);

        if v_slot_start > v_now then
          v_ok := not exists (
            select 1
              from booking_bookables bb
             where bb.bookable_id = v_anchor
               and bb.is_active
               and tstzrange(bb.block_start, bb.block_end, '[)')
                && tstzrange(v_block_start, v_block_end, '[)')
          );

          -- ① 從上一筆的地點趕得過來嗎
          if v_ok then
            select bb.block_end as block_end, bk.location_id as loc
              into v_prev
              from booking_bookables bb
              join bookings bk on bk.id = bb.booking_id
             where bb.bookable_id = v_anchor
               and bb.is_active
               and bb.block_end <= v_block_start
             order by bb.block_end desc
             limit 1;
            if found and v_prev.block_end
                 + make_interval(mins => travel_minutes(v_anchor, v_prev.loc, v_window.loc))
                 > v_block_start then
              v_ok := false;
            end if;
          end if;

          -- ② 做完趕得去下一筆嗎。漏了這項，下一位客人就會被放鴿子
          if v_ok then
            select bb.block_start as block_start, bk.location_id as loc
              into v_next
              from booking_bookables bb
              join bookings bk on bk.id = bb.booking_id
             where bb.bookable_id = v_anchor
               and bb.is_active
               and bb.block_start >= v_block_end
             order by bb.block_start
             limit 1;
            if found and v_block_end
                 + make_interval(mins => travel_minutes(v_anchor, v_window.loc, v_next.loc))
                 > v_next.block_start then
              v_ok := false;
            end if;
          end if;

          -- ③ 服務需要的其他標的（包廂、器材）也要同時空著
          if v_ok then
            v_ids := array[v_anchor];
            for v_req in
              select r.*
                from service_requirements r
               where r.service_id = p_service_id
                 and r.id <> v_anchor_req.id
            loop
              select b.id into v_extra
                from bookables b
               where b.tenant_id = p_tenant_id
                 and b.is_active
                 and case when v_req.bookable_id is not null
                          then b.id = v_req.bookable_id
                          else b.type = v_req.bookable_type end
                 and not (b.id = any(v_ids))
                 -- 包廂要跟老師在同一個據點，不然會約到別間店的房間
                 and (v_window.loc is null or b.location_id is null or b.location_id = v_window.loc)
                 and not exists (
                   select 1 from booking_bookables bb
                    where bb.bookable_id = b.id
                      and bb.is_active
                      and tstzrange(bb.block_start, bb.block_end, '[)')
                       && tstzrange(v_block_start, v_block_end, '[)')
                 )
               order by b.sort_order, b.id
               limit 1;

              if not found then
                v_ok := false;
                exit;
              end if;
              v_ids := v_ids || v_extra;
            end loop;
          end if;

          if v_ok then
            start_at     := v_slot_start;
            end_at       := v_slot_end;
            location_id  := v_window.loc;
            bookable_ids := v_ids;
            return next;
          end if;
        end if;

        v_ts := v_ts + interval '30 minutes';
      end loop;
    end loop;
  end loop;

  return;
end $$;

revoke all on function public.available_slots(uuid, uuid, date, uuid, int) from public;
grant execute on function public.available_slots(uuid, uuid, date, uuid, int) to anon, authenticated;
