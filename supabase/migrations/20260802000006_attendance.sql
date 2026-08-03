-- ═══════════════════════════════════════════════════════════════
-- 行前提醒的「我會到場」（2026-08-03）
-- 草稿：docs/mockups/booking-reminders.html
--
-- 提醒卡片給三顆按鈕：開地圖 / 我會到場 / 我無法前往。
-- 中間那顆是給職人看的——今天的名單上誰回過「我會到場」，
-- 誰從頭到尾沒回應，出門前心裡有數。
--
-- 這不是預約狀態的一部分：沒回覆不代表不來，多數人本來就不會回。
-- 所以只記時間，不動 bookings.status。
-- ═══════════════════════════════════════════════════════════════

alter table public.bookings
  add column if not exists attendance_confirmed_at timestamptz;

comment on column public.bookings.attendance_confirmed_at is
  '客人在行前提醒上按了「我會到場」的時間。沒值只代表他沒回，不代表不來';
