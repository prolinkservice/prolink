-- ═══════════════════════════════════════════════════════════════
-- 建立租戶（註冊精靈用）
--
-- 為什麼要用函式而不是直接 insert：
--   tenant_members 的 RLS 要求「你必須已經是這個租戶的 owner」，
--   但第一筆 owner 正是現在要建的 —— 雞生蛋問題。
--   security definer 繞過 RLS，同時把整段包成一個交易，
--   避免建到一半失敗留下半個租戶。
-- ═══════════════════════════════════════════════════════════════

create or replace function public.create_tenant(
  p_name          text,
  p_slug          text,
  p_display_name  text,
  p_service_name  text default null,
  p_duration_min  int  default 60,
  p_price         numeric default 0,
  p_weekdays      int[] default null,
  p_start_time    time default '10:00',
  p_end_time      time default '21:00'
)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_tenant   public.tenants;
  v_member   uuid;
  v_bookable uuid;
  v_service  uuid;
  v_weekday  int;
begin
  if v_uid is null then
    raise exception '請先登入' using errcode = '28000';
  end if;

  -- slug 已被使用或曾被使用（舊網址還在做 301，不能被搶走）
  if exists (select 1 from public.tenants where slug = p_slug)
     or exists (select 1 from public.tenant_slug_history where old_slug = p_slug) then
    raise exception '這個網址已經有人使用了' using errcode = '23505';
  end if;

  insert into public.tenants (slug, name)
  values (p_slug, p_name)
  returning * into v_tenant;

  insert into public.tenant_members (tenant_id, user_id, role, display_name, is_bookable)
  values (v_tenant.id, v_uid, 'owner', p_display_name, true)
  returning id into v_member;

  insert into public.tenant_settings (tenant_id) values (v_tenant.id);

  -- 老師本人就是第一個「可預約標的」
  insert into public.bookables (tenant_id, type, member_id, name)
  values (v_tenant.id, 'staff', v_member, p_display_name)
  returning id into v_bookable;

  if p_service_name is not null and length(trim(p_service_name)) > 0 then
    insert into public.services
      (tenant_id, name, duration_mode, duration_min, price, price_unit,
       location_mode, payment_mode)
    values
      (v_tenant.id, p_service_name, 'fixed', p_duration_min, p_price, 'per_session',
       'fixed', 'none')
    returning id into v_service;

    insert into public.service_requirements (service_id, bookable_type, bookable_id, quantity)
    values (v_service, 'staff', v_bookable, 1);
  end if;

  if p_weekdays is not null then
    foreach v_weekday in array p_weekdays loop
      insert into public.business_hours
        (tenant_id, bookable_id, location_id, weekday, start_time, end_time)
      values
        (v_tenant.id, v_bookable, null, v_weekday, p_start_time, p_end_time);
    end loop;
  end if;

  return v_tenant;
end $$;

revoke all on function public.create_tenant(
  text, text, text, text, int, numeric, int[], time, time
) from public;

grant execute on function public.create_tenant(
  text, text, text, text, int, numeric, int[], time, time
) to authenticated;


-- ═══════════════════════════════════════════════════════════════
-- slug 可用性檢查（註冊時即時提示用）
-- 匿名也能呼叫，但只回傳布林值，不洩漏任何租戶資料
-- ═══════════════════════════════════════════════════════════════

create or replace function public.slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.tenants where slug = p_slug)
     and not exists (select 1 from public.tenant_slug_history where old_slug = p_slug)
$$;

revoke all on function public.slug_available(text) from public;
grant execute on function public.slug_available(text) to anon, authenticated;
