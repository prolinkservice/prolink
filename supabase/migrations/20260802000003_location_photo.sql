-- ═══════════════════════════════════════════════════════════════
-- 據點照片
-- 草稿：docs/mockups/location-photo.html
--
-- 客人在選地點那一頁看到的橫幅。文字講不出「20 樓、安靜、
-- 不被打擾」是什麼感覺，照片可以。
--
-- 檔案放 Storage 的 location-photos（公開 bucket），
-- 這裡只存網址。上傳走伺服器動作並用 service role 寫，
-- 所以不需要替 storage.objects 另外開政策。
-- ═══════════════════════════════════════════════════════════════

alter table public.locations
  add column if not exists photo_url text;

comment on column public.locations.photo_url is
  '據點照片的公開網址。任何人拿到網址都看得到，所以後台要提醒職人「拍空間就好，不用拍到人」';
