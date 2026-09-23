-- ================================================
-- 026_otp_stage.sql
-- 개발비 선금·잔금을 모두 결제 행으로 관리
--   one_time_payments.stage : down(선금) | final(잔금) — type='dev_fee' 일 때만
-- AS-IS: 잔금만 one_time_payments 행 생성, 선금은 inquiries.down_paid_at 날짜만 → 매출 집계 누락
-- TO-BE: 견적 저장 시 선금·잔금 2행 생성(미납), 확인 시 paid
-- ================================================

BEGIN;

ALTER TABLE one_time_payments
  ADD COLUMN IF NOT EXISTS stage VARCHAR(10);

ALTER TABLE one_time_payments DROP CONSTRAINT IF EXISTS chk_otp_stage;
ALTER TABLE one_time_payments
  ADD CONSTRAINT chk_otp_stage CHECK (stage IS NULL OR stage IN ('down', 'final'));

COMMENT ON COLUMN one_time_payments.stage IS '개발비 단계: down(선금) | final(잔금). dev_fee 외에는 NULL';

-- 기존 dev_fee 행은 모두 잔금
UPDATE one_time_payments SET stage = 'final'
WHERE type = 'dev_fee' AND stage IS NULL;

-- 선금 납부 기록(inquiries.down_paid_at)이 있는 건 → 선금 결제 행 생성
INSERT INTO one_time_payments (customer_id, site_id, type, stage, amount, status, note, paid_at, created_at)
SELECT i.customer_id, s.site_id, 'dev_fee', 'down',
       FLOOR(i.dev_fee_total / 2), 'paid', '개발비 선금 50% (기존 확인분)', i.down_paid_at, i.down_paid_at
FROM inquiries i
LEFT JOIN sites s ON s.inquiry_id = i.inquiry_id AND s.use_flag = 1
WHERE i.use_flag = 1
  AND i.down_paid_at IS NOT NULL
  AND i.dev_fee_total IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM one_time_payments p
    WHERE p.customer_id = i.customer_id AND p.type = 'dev_fee' AND p.stage = 'down' AND p.use_flag = 1
  );

-- 견적은 있는데 선금 결제 행이 없는 건 → 미납 행 생성
INSERT INTO one_time_payments (customer_id, site_id, type, stage, amount, status, note)
SELECT i.customer_id, s.site_id, 'dev_fee', 'down',
       FLOOR(i.dev_fee_total / 2), 'unpaid', '개발비 선금 50%'
FROM inquiries i
LEFT JOIN sites s ON s.inquiry_id = i.inquiry_id AND s.use_flag = 1
WHERE i.use_flag = 1
  AND i.down_paid_at IS NULL
  AND i.dev_fee_total IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM one_time_payments p
    WHERE p.customer_id = i.customer_id AND p.type = 'dev_fee' AND p.stage = 'down' AND p.use_flag = 1
  );

CREATE INDEX IF NOT EXISTS idx_one_time_stage ON one_time_payments(type, stage);

COMMIT;


-- ================================================
-- 검증
-- ================================================
-- SELECT c.name, p.type, p.stage, p.amount, p.status
--   FROM one_time_payments p JOIN customers c ON c.customer_id = p.customer_id
--   WHERE p.use_flag = 1 ORDER BY c.name, p.stage;
