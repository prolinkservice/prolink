-- 評價系統：reviews 表
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade unique,
  practitioner_id uuid not null references practitioners(id) on delete cascade,
  customer_id uuid not null references profiles(id) on delete cascade,
  rating smallint not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now()
);

alter table reviews enable row level security;

-- 任何人都可以讀取評價（公開展示在老師頁）
create policy "reviews_select_public" on reviews
  for select using (true);

-- 客戶只能對「自己的已完成預約」新增一筆評價
create policy "reviews_insert_own_completed_booking" on reviews
  for insert with check (
    customer_id = auth.uid()
    and exists (
      select 1 from bookings b
      where b.id = booking_id
        and b.customer_id = auth.uid()
        and b.status = 'completed'
    )
  );

-- 客戶可以修改自己的評價
create policy "reviews_update_own" on reviews
  for update using (customer_id = auth.uid());

create index if not exists idx_reviews_practitioner on reviews(practitioner_id);
