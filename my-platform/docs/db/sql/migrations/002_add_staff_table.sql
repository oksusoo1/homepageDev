-- ================================================
-- 002_add_staff_table.sql
-- 기존 DB에 staff 테이블 추가
-- schema_v2.1 이전 버전 DB에 적용
-- ================================================

CREATE TABLE IF NOT EXISTS staff (
  staff_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id     UUID UNIQUE NOT NULL,                  -- FK → auth.users(id)
  email       VARCHAR(200) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  -- role: platform_admin(플랫폼관리) | support(지원) | viewer(읽기전용)
  role        VARCHAR(30) NOT NULL DEFAULT 'platform_admin'
              CHECK (role IN ('platform_admin', 'support', 'viewer')),
  -- status: active(재직) | suspended(정지) | left(퇴사)
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'suspended', 'left')),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_auth_id ON staff(auth_id);
CREATE INDEX IF NOT EXISTS idx_staff_email    ON staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_status   ON staff(status);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'staff' AND policyname = 'staff_all'
  ) THEN
    CREATE POLICY "staff_all" ON staff FOR ALL USING (true);
  END IF;
END $$;

-- ================================================
-- 관리자 등록 예시 (auth.users 에 계정 생성 후 실행)
-- ================================================
-- INSERT INTO staff (auth_id, email, name, role)
-- VALUES (
--   'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  -- auth.users.id
--   'admin@company.com',
--   '관리자',
--   'platform_admin'
-- );
