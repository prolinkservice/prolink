-- 服務分類篩選：擴大產品定位涵蓋運動按摩/整復/泰式按摩/美容/美甲/健身教練
alter table services add column if not exists category text
  check (category in ('運動按摩','整復','泰式按摩','美容','美甲','健身教練'));

update services set category = '運動按摩' where name like '%運動按摩%' and category is null;
update services set category = '健身教練' where name like '%教練%' and category is null;
update services set category = '運動按摩' where category is null;
