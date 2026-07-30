-- ═══════════════════════════════════════════════════════════════
-- 服務項目的固定據點
--
-- 地點模式選「固定店面」而店裡有兩個以上據點時，要能指定
-- 「這項服務只在哪一間做」（規格 §8.2、progressive-settings.html 情況 B）。
-- 沒有這一欄，客人就得自己選地點，而他根本不知道該選哪間。
--
-- 只有一個據點的店完全用不到這一欄，維持 null 即可。
-- ═══════════════════════════════════════════════════════════════

alter table public.services
  add column if not exists location_id uuid
    references public.locations on delete set null;

comment on column public.services.location_id is
  'location_mode = fixed 且據點 ≥ 2 時指定的固定據點；null 表示不限定';
