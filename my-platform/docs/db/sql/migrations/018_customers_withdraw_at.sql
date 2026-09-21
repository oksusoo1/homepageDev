-- ================================================
-- 018_customers_withdraw_at.sql
-- 탈퇴 예약일 (구독 잔여 기간 보장)
-- ================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS withdraw_at TIMESTAMP;

COMMENT ON COLUMN customers.withdraw_at IS
  '탈퇴 예약일 — 미래: 만료 대기(로그인 가능), 과거: /my 진입 시 withdrawn 처리';
