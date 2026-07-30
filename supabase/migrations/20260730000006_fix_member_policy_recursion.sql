-- ═══════════════════════════════════════════════════════════════
-- 修正 tenant_members 政策的無限遞迴
--
-- 症狀：明明是工作室的擁有者，後台卻說「這個帳號還沒有工作室」，
-- 被丟去註冊精靈，而且 slug 顯示已被使用（因為它確實存在，只是你看不到）。
--
-- 原因：owner_manage 是 for all 的政策，SELECT 也會套用它。
-- 它的 using 子句直接查 tenant_members 自己，於是查 tenant_members 要先
-- 評估政策、評估政策又要查 tenant_members ——
-- PostgreSQL 判定為無限遞迴（42P17）並讓整個查詢失敗。
--
-- member_read 那條沒事，是因為它用的 current_tenant_ids() 是
-- security definer，不受 RLS 影響。這裡用同樣的手法解決。
-- ═══════════════════════════════════════════════════════════════

create or replace function public.is_tenant_owner(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenant_members m
     where m.tenant_id = p_tenant_id
       and m.user_id = auth.uid()
       and m.role = 'owner'
  )
$$;

revoke all on function public.is_tenant_owner(uuid) from public;
grant execute on function public.is_tenant_owner(uuid) to authenticated;

drop policy if exists owner_manage on public.tenant_members;

create policy owner_manage on public.tenant_members
  for all to authenticated
  using (public.is_tenant_owner(tenant_id))
  with check (public.is_tenant_owner(tenant_id));
