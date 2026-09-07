-- ================================================
-- 009_user_messages_board.sql
-- 사용자 문의 게시판: 공개/비공개 · 답글
-- status: new(미답변) | replied(답변완료) | done(종료)
-- ================================================

ALTER TABLE user_messages
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE user_messages
  ADD COLUMN IF NOT EXISTS reply_content TEXT;

ALTER TABLE user_messages
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP;

-- 기존 status 값 정리 후 CHECK 교체
UPDATE user_messages SET status = 'new' WHERE status IN ('read');
UPDATE user_messages
  SET status = 'replied', replied_at = COALESCE(replied_at, updated_at, NOW())
  WHERE reply_content IS NOT NULL AND status <> 'replied';

ALTER TABLE user_messages DROP CONSTRAINT IF EXISTS user_messages_status_check;

ALTER TABLE user_messages
  ADD CONSTRAINT user_messages_status_check
  CHECK (status IN ('new', 'replied', 'done'));

CREATE INDEX IF NOT EXISTS idx_user_messages_is_private
  ON user_messages(is_private);

COMMENT ON COLUMN user_messages.is_private IS 'true=비공개(목록에 내용 숨김, 고객만 열람)';
COMMENT ON COLUMN user_messages.reply_content IS '고객(운영자) 답글';

-- ================================================
-- 검증
-- ================================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'user_messages'
-- ORDER BY ordinal_position;
