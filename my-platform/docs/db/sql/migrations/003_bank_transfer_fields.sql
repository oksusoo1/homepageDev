-- ================================================
-- 003_bank_transfer_fields.sql
-- 계좌이체 레인 (플로우 v1.3.1)
-- ================================================

-- subscriptions: 이체 등록 정보
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS depositor_name VARCHAR(100);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS bank_transfer_agreed_at TIMESTAMP;

-- billing_history: 납부 기한 (미입금 +2일 정지 계산용)
ALTER TABLE billing_history ADD COLUMN IF NOT EXISTS due_at DATE;

-- 기존 unpaid 행: period 기준 말일을 due_at 으로 보정 (선택)
-- UPDATE billing_history SET due_at = (period || '-01')::date + INTERVAL '1 month' - INTERVAL '1 day'
-- WHERE due_at IS NULL AND status IN ('unpaid', 'overdue');
