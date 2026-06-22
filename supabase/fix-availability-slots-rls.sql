-- 修正 availability_slots 的 RLS 規則：practitioner_id 是 practitioners 表的 id，
-- 不是登入帳號的 auth.uid()，需透過 practitioners.user_id 對應。
drop policy if exists "availability_slots: practitioner manage own" on availability_slots;

create policy "availability_slots: practitioner manage own" on availability_slots
  for all
  using (
    practitioner_id in (select id from practitioners where user_id = auth.uid())
  )
  with check (
    practitioner_id in (select id from practitioners where user_id = auth.uid())
  );
