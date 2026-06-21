-- 老師會員中心：銀行帳戶審核、身份驗證、社群連結
alter table practitioners
  add column if not exists bank_status text not null default 'pending' check (bank_status in ('pending', 'approved', 'rejected')),
  add column if not exists id_front_url text,
  add column if not exists id_back_url text,
  add column if not exists id_verification_status text not null default 'pending' check (id_verification_status in ('pending', 'approved', 'rejected')),
  add column if not exists social_links jsonb not null default '[]'::jsonb;
