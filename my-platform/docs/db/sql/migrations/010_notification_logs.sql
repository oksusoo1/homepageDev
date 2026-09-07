-- ================================================
-- 010_notification_logs.sql
-- 알림톡/배치 목업 로그 (실발송 전 기록용)
-- ================================================

CREATE TABLE IF NOT EXISTS notification_logs (
  notification_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- type: bank_remind | bank_suspend | card_charged
  type              VARCHAR(50) NOT NULL,
  channel           VARCHAR(50) NOT NULL DEFAULT 'mock_alimtalk',
  site_id           UUID REFERENCES sites(site_id) ON DELETE SET NULL,
  customer_id       UUID REFERENCES customers(customer_id) ON DELETE SET NULL,
  subscription_id   UUID REFERENCES subscriptions(subscription_id) ON DELETE SET NULL,
  payload           JSONB,
  as_of_date        DATE NOT NULL,                 -- 배치가 가정한 "오늘"
  use_flag          SMALLINT NOT NULL DEFAULT 1
                    CHECK (use_flag IN (0, 1)),
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_logs_type ON notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_notif_logs_as_of ON notification_logs(as_of_date);
CREATE INDEX IF NOT EXISTS idx_notif_logs_sub ON notification_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_notif_logs_use_flag ON notification_logs(use_flag);

-- 같은 구독·유형·가상일자 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_sub_type_asof
  ON notification_logs(subscription_id, type, as_of_date)
  WHERE use_flag = 1 AND subscription_id IS NOT NULL;

COMMENT ON TABLE notification_logs IS
  '배치/알림 목업 로그. 실 알림톡 연동 전 기록. 수동 배치 또는 cron이 INSERT';

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notification_logs' AND policyname = 'notification_logs_all'
  ) THEN
    CREATE POLICY "notification_logs_all" ON notification_logs FOR ALL USING (true);
  END IF;
END $$;
