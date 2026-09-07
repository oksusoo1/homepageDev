-- ================================================
-- 007_user_messages.sql
-- 사용자(방문자) → 고객(사장님) 문의
--
-- 주체 용어 (플랫폼 기준)
--   customers = 고객(사장님) · staff = 직원(본사) · user = 사용자(방문자)
--
-- 사용자(공개 사이트) 테이블만 user_ 접두
--   user_messages     = 사용자 → 고객  (공개 /contact)
--   user_posts        = 사용자 사이트 게시판  (008에서 posts RENAME)
--   support_tickets   = 고객 → 직원    (수정 요청, /my)
--   inquiries         = 고객 → 직원    (본사 제작 의뢰)
-- ================================================

CREATE TABLE IF NOT EXISTS user_messages (
  user_message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(site_id) ON DELETE RESTRICT,
  name            VARCHAR(100) NOT NULL,          -- 사용자 이름
  phone           VARCHAR(50),                    -- 연락처 (선택)
  email           VARCHAR(200),                   -- 이메일 (선택)
  content         TEXT NOT NULL,                  -- 문의 내용
  -- status: new(미확인) | read(확인) | done(처리완료)
  status          VARCHAR(20) NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'read', 'done')),
  use_flag        SMALLINT NOT NULL DEFAULT 1     -- 1=사용 · 0=삭제
                  CHECK (use_flag IN (0, 1)),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_messages_site_id
  ON user_messages(site_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_status
  ON user_messages(status);
CREATE INDEX IF NOT EXISTS idx_user_messages_use_flag
  ON user_messages(use_flag);
CREATE INDEX IF NOT EXISTS idx_user_messages_created
  ON user_messages(created_at DESC);

COMMENT ON TABLE user_messages IS
  '사용자(방문자)→고객(사장님) 문의. support_tickets·inquiries 와 구분';

ALTER TABLE user_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_messages' AND policyname = 'user_messages_all'
  ) THEN
    CREATE POLICY "user_messages_all" ON user_messages FOR ALL USING (true);
  END IF;
END $$;

-- ================================================
-- 검증
-- ================================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'user_messages'
-- ORDER BY ordinal_position;
