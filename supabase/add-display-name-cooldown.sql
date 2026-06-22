-- 姓名修改七天冷卻期：記錄上次修改時間，伺服器端強制檢查
alter table profiles add column if not exists display_name_updated_at timestamptz;
