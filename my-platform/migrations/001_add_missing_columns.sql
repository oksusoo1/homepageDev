-- ================================================
-- 001_add_missing_columns.sql
-- 기존 DB에 누락된 컬럼 및 CHECK 제약 조건 추가
-- supabase_schema_mvp_v2.sql 이미 실행한 DB에 적용
-- ================================================

-- 1. customers.auth_id 컬럼 추가
ALTER TABLE customers ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;

-- 2. sites.trial 관련 컬럼 추가
ALTER TABLE sites ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;

-- 3. subscriptions.status CHECK에 trial, pending 추가
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('pending', 'trial', 'active', 'paused', 'cancelled'));

-- 4. sync_site_status 트리거에 trial 상태 처리 추가
CREATE OR REPLACE FUNCTION sync_site_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN
    UPDATE sites SET status = 'cancelled', updated_at = NOW()
    WHERE site_id = NEW.site_id;
  ELSIF NEW.status = 'paused' THEN
    UPDATE sites SET status = 'suspended', updated_at = NOW()
    WHERE site_id = NEW.site_id;
  ELSIF NEW.status IN ('active', 'trial') THEN
    UPDATE sites SET status = 'published', updated_at = NOW()
    WHERE site_id = NEW.site_id AND status = 'suspended';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
