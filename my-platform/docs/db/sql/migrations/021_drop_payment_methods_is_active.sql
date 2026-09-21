-- ================================================
-- 021_drop_payment_methods_is_active.sql
-- 카드: 활성/삭제는 use_flag 단일화 (is_active · is_default 제거)
-- ================================================

-- 기존 비활성 카드를 soft delete 로 맞춤
UPDATE customer_payment_methods
SET use_flag = 0
WHERE is_active = false
  AND use_flag = 1;

DROP INDEX IF EXISTS idx_pay_methods_active;

ALTER TABLE customer_payment_methods
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS is_default;
