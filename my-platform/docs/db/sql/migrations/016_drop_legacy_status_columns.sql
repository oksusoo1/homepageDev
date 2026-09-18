-- ================================================
-- 016_drop_legacy_status_columns.sql
-- 진도·체험·구독·정지 = sites.status (FLOW_STEP) 만
-- ================================================
-- DROP:
--   sites.deploy_status
--   inquiries.status   (금액·납부일만 유지)
--   subscriptions.status (청구 대상은 sites.status + cancelled_at)
-- ================================================

DROP INDEX IF EXISTS idx_inquiries_status;
DROP INDEX IF EXISTS idx_subscriptions_status;

ALTER TABLE sites DROP COLUMN IF EXISTS deploy_status;
ALTER TABLE inquiries DROP COLUMN IF EXISTS status;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS status;

COMMENT ON COLUMN sites.status IS
  'FLOW_STEP — 진도·공개·체험/구독/정지의 유일한 상태 (deploy_status·inquiries.status·subscriptions.status 제거)';

COMMENT ON TABLE inquiries IS
  '제작의뢰 — 금액·납부일(dev_fee_total, down_paid_at, final_paid_at). 진도는 sites.status';

COMMENT ON TABLE subscriptions IS
  '구독·청구 — 금액·청구일·결제수단·cancelled_at. 생명주기는 sites.status (trial|subscribed|suspended)';
