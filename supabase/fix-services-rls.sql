-- 修正 services 表的 RLS 規則：跟 practitioners / availability_slots 同樣的問題，
-- practitioner_id 是 practitioners 表的 id，不是登入帳號的 auth.uid()，需透過 practitioners.user_id 對應。
-- 先查詢目前規則內容：
-- select policyname, cmd, qual, with_check from pg_policies where tablename = 'services';

drop policy if exists "services: practitioner manage own" on services;

create policy "services: practitioner manage own" on services
  for all
  using (
    practitioner_id in (select id from practitioners where user_id = auth.uid())
  )
  with check (
    practitioner_id in (select id from practitioners where user_id = auth.uid())
  );
