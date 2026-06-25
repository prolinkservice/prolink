-- 職人後台通知中心：新預約／收到評價／審核結果
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  type text not null check (type in ('new_booking', 'new_review', 'verification_result')),
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "notifications: self read" on notifications for select
  using (auth.uid() = user_id);

create policy "notifications: self update (mark read)" on notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 通知是系統觸發（例如客戶建立預約時要通知老師），所以允許任何登入者寫入，
-- 讀取/標記已讀仍嚴格限制本人，不會洩漏資料
create policy "notifications: any authenticated user can create" on notifications for insert
  to authenticated
  with check (true);
