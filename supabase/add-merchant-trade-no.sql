-- 綠界金流串接：每筆預約對應一個綠界訂單編號，callback 用它找回對應的 booking
alter table bookings add column if not exists merchant_trade_no text unique;
