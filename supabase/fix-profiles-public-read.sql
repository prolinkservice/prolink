-- 修復：首頁/老師詳細頁顯示「老師」而非真名
-- 原因：profiles 表 RLS 只允許本人讀取，匿名訪客無法 join 到 display_name/avatar_url
-- 解法：新增政策，允許任何人讀取「已上架（approved）職人」對應的 profiles 資料
create policy "public can read approved practitioner profiles"
on profiles for select
to anon, authenticated
using (
  id in (
    select user_id from practitioners where status = 'approved' and user_id is not null
  )
);
