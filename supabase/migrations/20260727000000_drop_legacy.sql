-- ═══════════════════════════════════════════════════════════════
-- 移除舊媒合平台的資料表
--
-- ⚠️ 這會刪除所有資料，無法復原。確認過沒有需要保留的內容再執行。
--
-- 執行順序：
--   1. 這一支（清掉舊表）
--   2. 20260728000001_core_schema.sql
--   3. 20260728000002_rls.sql
--
-- 保留不動：
--   · Storage buckets（avatars / covers / verification-docs）
--   · auth.users（使用者帳號本身）
-- ═══════════════════════════════════════════════════════════════

-- 先看一眼現在有哪些表，確認下面的清單沒有遺漏
-- select table_name from information_schema.tables
--  where table_schema = 'public' order by table_name;

-- 依賴關係由 cascade 處理，順序不重要
drop table if exists public.transactions              cascade;
drop table if exists public.cancellation_requests     cascade;
drop table if exists public.client_notes              cascade;
drop table if exists public.notifications             cascade;
drop table if exists public.reviews                   cascade;
drop table if exists public.practitioner_subscriptions cascade;
drop table if exists public.availability_slots        cascade;
drop table if exists public.bookings                  cascade;
drop table if exists public.services                  cascade;
drop table if exists public.practitioners             cascade;
drop table if exists public.profiles                  cascade;

-- ── 執行後請檢查 ────────────────────────────────────────────────
-- 舊系統若在 auth.users 上掛了「自動建立 profile」的觸發器，
-- profiles 被刪掉之後那個觸發器會讓「註冊新帳號」直接失敗。
-- 用這段查有沒有殘留：
--
--   select tgname, pg_get_triggerdef(oid)
--     from pg_trigger
--    where tgrelid = 'auth.users'::regclass and not tgisinternal;
--
-- 有的話一併移除（把 <名稱> 換成查到的）：
--   drop trigger if exists <名稱> on auth.users;
--   drop function if exists public.handle_new_user() cascade;
