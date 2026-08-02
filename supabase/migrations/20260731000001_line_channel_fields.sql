-- ═══════════════════════════════════════════════════════════════
-- LINE 官方帳號：連上之後要記住的東西
--
-- · bot_basic_id / bot_display_name：驗證憑證時跟 LINE 問到的答案。
--   顯示在後台讓職人一眼確認「我接到的是不是我自己那個帳號」。
-- · operator_bind_code：一次性的綁定碼。職人用自己的 LINE 傳這串給
--   官方帳號，webhook 收到就把他登記成操作者——之後測試訊息、
--   一句話建立預約都要知道「他本人的 LINE 是哪個」。
--   不用「第一個傳訊息的人就是老闆」，那等於誰先傳誰是老闆。
-- ═══════════════════════════════════════════════════════════════

alter table public.tenant_line_channels
  add column if not exists bot_basic_id       text,
  add column if not exists bot_display_name   text,
  add column if not exists operator_bind_code text,
  add column if not exists last_checked_at    timestamptz;

comment on column public.tenant_line_channels.operator_bind_code is
  '一次性綁定碼。職人傳這串給自己的官方帳號，webhook 才知道他本人是誰';
