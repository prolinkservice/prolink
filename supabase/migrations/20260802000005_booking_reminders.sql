-- ═══════════════════════════════════════════════════════════════
-- Sprint 2 第三批：行前提醒
-- 草稿：docs/mockups/booking-reminders.html
--
-- 每天中午 12:00 掃一次，提醒明天要來的客人，訊息裡附一顆「我無法前往」。
-- 客人在前一天中午收到，還有一整個下午可以說他不能來——那個時段就賣得掉。
-- 這是市面上（夯客）驗證過的節奏，也是 Vercel Hobby 一天一次排程做得到的。
-- ═══════════════════════════════════════════════════════════════

alter table public.bookings
  add column if not exists reminder_sent_at timestamptz;

comment on column public.bookings.reminder_sent_at is
  '行前提醒發出去的時間。有值就不再發第二次——排程重跑、手動觸發都可能重複掃到';


alter table public.tenant_settings
  add column if not exists reminder_enabled boolean not null default true,
  add column if not exists reminder_note    text;

comment on column public.tenant_settings.reminder_enabled is
  '每天中午提醒明天要來的客人。預設開，每筆預約多 1 則額度';
comment on column public.tenant_settings.reminder_note is
  '接在提醒訊息裡的一句話，例如「三樓沒有電梯」。留空就不加';


-- 排程每天只撈「還沒提醒過、狀態已確認」的那幾筆。
-- 部分索引讓這個查詢不必掃整張 bookings——已提醒與已結案的都不在索引裡
create index if not exists bookings_reminder_pending_idx
  on public.bookings (start_at)
  where reminder_sent_at is null and status = 'confirmed';
