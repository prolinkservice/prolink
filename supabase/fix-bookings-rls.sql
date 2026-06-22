-- 修正 bookings 表的 RLS 規則：同樣的問題，practitioner_id 是 practitioners 表的 id，
-- 不是登入帳號的 auth.uid()，導致職人後台看不到自己的預約。
drop policy if exists "bookings: practitioner read own" on bookings;
drop policy if exists "bookings: practitioner update own" on bookings;

create policy "bookings: practitioner read own" on bookings
  for select
  using (
    practitioner_id in (select id from practitioners where user_id = auth.uid())
  );

create policy "bookings: practitioner update own" on bookings
  for update
  using (
    practitioner_id in (select id from practitioners where user_id = auth.uid())
  );
