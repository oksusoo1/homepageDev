-- ================================================
-- 011_common_codes.sql
-- 공통코드 (AIFRONT식): 그룹 + 코드 / 표시명 관리
-- 코드값(code)은 불변 · 표시명(label)·설명·순서·사용여부만 변경
-- ================================================

CREATE TABLE IF NOT EXISTS code_groups (
  code_group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_code    VARCHAR(50) NOT NULL UNIQUE,     -- BUILD_TYPE, SITE_STATUS ...
  name          VARCHAR(100) NOT NULL,           -- 화면 그룹명
  description   TEXT,
  ref_hint      VARCHAR(100),                    -- 예: sites.build_type
  use_flag      SMALLINT NOT NULL DEFAULT 1
                CHECK (use_flag IN (0, 1)),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS common_codes (
  common_code_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_group_id  UUID NOT NULL REFERENCES code_groups(code_group_id) ON DELETE RESTRICT,
  code           VARCHAR(50) NOT NULL,           -- DB에 저장되는 값 (변경 금지)
  label          VARCHAR(100) NOT NULL,          -- 표시명
  description    TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 10,
  use_flag       SMALLINT NOT NULL DEFAULT 1
                 CHECK (use_flag IN (0, 1)),
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW(),
  UNIQUE (code_group_id, code)
);

CREATE INDEX IF NOT EXISTS idx_common_codes_group ON common_codes(code_group_id);
CREATE INDEX IF NOT EXISTS idx_common_codes_use_flag ON common_codes(use_flag);
CREATE INDEX IF NOT EXISTS idx_code_groups_use_flag ON code_groups(use_flag);

COMMENT ON TABLE code_groups IS '공통코드 그룹. group_code 불변.';
COMMENT ON TABLE common_codes IS '공통코드. code 불변, label/설명/순서/사용만 변경.';

ALTER TABLE code_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE common_codes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'code_groups' AND policyname = 'code_groups_all'
  ) THEN
    CREATE POLICY "code_groups_all" ON code_groups FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'common_codes' AND policyname = 'common_codes_all'
  ) THEN
    CREATE POLICY "common_codes_all" ON common_codes FOR ALL USING (true);
  END IF;
END $$;

-- ---------- seed (없을 때만) ----------
INSERT INTO code_groups (group_code, name, description, ref_hint)
SELECT * FROM (VALUES
  ('BUILD_TYPE', '사이트 제작 유형', '고객 직접 vs 본사 대리', 'sites.build_type'),
  ('SITE_STATUS', '사이트 상태', NULL, 'sites.status'),
  ('DEPLOY_STATUS', '배포 상태', NULL, 'sites.deploy_status'),
  ('SUB_STATUS', '구독 상태', NULL, 'subscriptions.status'),
  ('PAYMENT_METHOD', '결제 수단', NULL, 'subscriptions.payment_method'),
  ('OTP_TYPE', '1회성 결제 유형', NULL, 'one_time_payments.type'),
  ('OTP_STATUS', '1회성 결제 상태', NULL, 'one_time_payments.status'),
  ('INQUIRY_STATUS', '제작 문의 상태', NULL, 'inquiries.status'),
  ('TICKET_STATUS', '수정요청 상태', NULL, 'support_tickets.status'),
  ('TICKET_CATEGORY', '수정요청 유형', NULL, 'support_tickets.category'),
  ('USER_MSG_STATUS', '방문자 문의 상태', NULL, 'user_messages.status'),
  ('CUSTOMER_STATUS', '고객 상태', NULL, 'customers.status'),
  ('STAFF_ROLE', '직원 역할', NULL, 'staff.role')
) AS v(group_code, name, description, ref_hint)
WHERE NOT EXISTS (SELECT 1 FROM code_groups g WHERE g.group_code = v.group_code);

-- helper: insert code if missing
DO $$
DECLARE
  gid UUID;
BEGIN
  SELECT code_group_id INTO gid FROM code_groups WHERE group_code = 'BUILD_TYPE';
  IF gid IS NOT NULL THEN
    INSERT INTO common_codes (code_group_id, code, label, description, sort_order)
    SELECT gid, x.code, x.label, x.description, x.sort_order FROM (VALUES
      ('self', '직접', '고객 직접 제작 (루트 A)', 10),
      ('managed', '대리', '본사 대리 제작 (루트 B)', 20)
    ) AS x(code, label, description, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM common_codes c WHERE c.code_group_id = gid AND c.code = x.code);
  END IF;

  SELECT code_group_id INTO gid FROM code_groups WHERE group_code = 'SITE_STATUS';
  IF gid IS NOT NULL THEN
    INSERT INTO common_codes (code_group_id, code, label, description, sort_order)
    SELECT gid, x.code, x.label, x.description, x.sort_order FROM (VALUES
      ('draft', '준비중', NULL, 10),
      ('review', '검수중', NULL, 20),
      ('published', '운영중', NULL, 30),
      ('suspended', '정지', NULL, 40),
      ('cancelled', '해지', NULL, 50)
    ) AS x(code, label, description, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM common_codes c WHERE c.code_group_id = gid AND c.code = x.code);
  END IF;

  SELECT code_group_id INTO gid FROM code_groups WHERE group_code = 'DEPLOY_STATUS';
  IF gid IS NOT NULL THEN
    INSERT INTO common_codes (code_group_id, code, label, description, sort_order)
    SELECT gid, x.code, x.label, x.description, x.sort_order FROM (VALUES
      ('pending', '대기', NULL, 10),
      ('building', '빌드중', NULL, 20),
      ('live', '라이브', NULL, 30),
      ('failed', '실패', NULL, 40)
    ) AS x(code, label, description, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM common_codes c WHERE c.code_group_id = gid AND c.code = x.code);
  END IF;

  SELECT code_group_id INTO gid FROM code_groups WHERE group_code = 'SUB_STATUS';
  IF gid IS NOT NULL THEN
    INSERT INTO common_codes (code_group_id, code, label, description, sort_order)
    SELECT gid, x.code, x.label, x.description, x.sort_order FROM (VALUES
      ('pending', '대기', NULL, 10),
      ('trial', '체험', NULL, 20),
      ('active', '구독중', NULL, 30),
      ('paused', '일시정지', NULL, 40),
      ('cancelled', '해지', NULL, 50)
    ) AS x(code, label, description, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM common_codes c WHERE c.code_group_id = gid AND c.code = x.code);
  END IF;

  SELECT code_group_id INTO gid FROM code_groups WHERE group_code = 'PAYMENT_METHOD';
  IF gid IS NOT NULL THEN
    INSERT INTO common_codes (code_group_id, code, label, description, sort_order)
    SELECT gid, x.code, x.label, x.description, x.sort_order FROM (VALUES
      ('card', '카드 자동결제', NULL, 10),
      ('manual', '계좌이체', NULL, 20)
    ) AS x(code, label, description, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM common_codes c WHERE c.code_group_id = gid AND c.code = x.code);
  END IF;

  SELECT code_group_id INTO gid FROM code_groups WHERE group_code = 'OTP_TYPE';
  IF gid IS NOT NULL THEN
    INSERT INTO common_codes (code_group_id, code, label, description, sort_order)
    SELECT gid, x.code, x.label, x.description, x.sort_order FROM (VALUES
      ('domain_setup', '도메인 대행', NULL, 10),
      ('dev_fee', '개발비', NULL, 20),
      ('extra', '기타', NULL, 30)
    ) AS x(code, label, description, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM common_codes c WHERE c.code_group_id = gid AND c.code = x.code);
  END IF;

  SELECT code_group_id INTO gid FROM code_groups WHERE group_code = 'OTP_STATUS';
  IF gid IS NOT NULL THEN
    INSERT INTO common_codes (code_group_id, code, label, description, sort_order)
    SELECT gid, x.code, x.label, x.description, x.sort_order FROM (VALUES
      ('unpaid', '미납', NULL, 10),
      ('pending_confirm', '입금확인대기', NULL, 20),
      ('paid', '납부완료', NULL, 30)
    ) AS x(code, label, description, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM common_codes c WHERE c.code_group_id = gid AND c.code = x.code);
  END IF;

  SELECT code_group_id INTO gid FROM code_groups WHERE group_code = 'INQUIRY_STATUS';
  IF gid IS NOT NULL THEN
    INSERT INTO common_codes (code_group_id, code, label, description, sort_order)
    SELECT gid, x.code, x.label, x.description, x.sort_order FROM (VALUES
      ('received', '접수', NULL, 10),
      ('reviewing', '검토/견적', NULL, 20),
      ('building', '제작중', NULL, 30),
      ('review', '고객검수·잔금', NULL, 40),
      ('approved', '서비스시작준비', NULL, 50),
      ('done', '배포완료', NULL, 60)
    ) AS x(code, label, description, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM common_codes c WHERE c.code_group_id = gid AND c.code = x.code);
  END IF;

  SELECT code_group_id INTO gid FROM code_groups WHERE group_code = 'TICKET_STATUS';
  IF gid IS NOT NULL THEN
    INSERT INTO common_codes (code_group_id, code, label, description, sort_order)
    SELECT gid, x.code, x.label, x.description, x.sort_order FROM (VALUES
      ('open', '접수', NULL, 10),
      ('in_progress', '처리중', NULL, 20),
      ('resolved', '완료', NULL, 30)
    ) AS x(code, label, description, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM common_codes c WHERE c.code_group_id = gid AND c.code = x.code);
  END IF;

  SELECT code_group_id INTO gid FROM code_groups WHERE group_code = 'TICKET_CATEGORY';
  IF gid IS NOT NULL THEN
    INSERT INTO common_codes (code_group_id, code, label, description, sort_order)
    SELECT gid, x.code, x.label, x.description, x.sort_order FROM (VALUES
      ('text_change', '텍스트 수정', NULL, 10),
      ('image', '이미지 교체', NULL, 20),
      ('page_add', '페이지 추가', NULL, 30),
      ('feature', '기능 추가', NULL, 40),
      ('etc', '기타', NULL, 50)
    ) AS x(code, label, description, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM common_codes c WHERE c.code_group_id = gid AND c.code = x.code);
  END IF;

  SELECT code_group_id INTO gid FROM code_groups WHERE group_code = 'USER_MSG_STATUS';
  IF gid IS NOT NULL THEN
    INSERT INTO common_codes (code_group_id, code, label, description, sort_order)
    SELECT gid, x.code, x.label, x.description, x.sort_order FROM (VALUES
      ('new', '미답변', NULL, 10),
      ('replied', '답변완료', NULL, 20),
      ('done', '종료', NULL, 30)
    ) AS x(code, label, description, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM common_codes c WHERE c.code_group_id = gid AND c.code = x.code);
  END IF;

  SELECT code_group_id INTO gid FROM code_groups WHERE group_code = 'CUSTOMER_STATUS';
  IF gid IS NOT NULL THEN
    INSERT INTO common_codes (code_group_id, code, label, description, sort_order)
    SELECT gid, x.code, x.label, x.description, x.sort_order FROM (VALUES
      ('active', '정상', NULL, 10),
      ('suspended', '정지', NULL, 20),
      ('withdrawn', '탈퇴', NULL, 30)
    ) AS x(code, label, description, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM common_codes c WHERE c.code_group_id = gid AND c.code = x.code);
  END IF;

  SELECT code_group_id INTO gid FROM code_groups WHERE group_code = 'STAFF_ROLE';
  IF gid IS NOT NULL THEN
    INSERT INTO common_codes (code_group_id, code, label, description, sort_order)
    SELECT gid, x.code, x.label, x.description, x.sort_order FROM (VALUES
      ('platform_admin', '플랫폼관리자', NULL, 10),
      ('support', '고객지원', NULL, 20),
      ('viewer', '조회전용', NULL, 30)
    ) AS x(code, label, description, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM common_codes c WHERE c.code_group_id = gid AND c.code = x.code);
  END IF;
END $$;
