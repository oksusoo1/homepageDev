-- ================================================
-- 025_ticket_message_read.sql
-- 고객 요청 대화 읽음 처리 — 알림·뱃지가 읽으면 사라지도록
--   read_at : 상대방이 읽은 시각
--     staff 메시지  → 사장님이 「본사 요청」 화면을 열면 기록
--     customer 메시지 → 직원이 요청 카드를 펼치면 기록
-- 내부 메모(is_internal)는 읽음 대상 아님 (고객에게 가지 않음)
-- ================================================

BEGIN;

ALTER TABLE support_ticket_messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_ticket_msgs_unread
  ON support_ticket_messages(ticket_id, author_type)
  WHERE read_at IS NULL AND use_flag = 1;

COMMENT ON COLUMN support_ticket_messages.read_at IS '상대방이 읽은 시각. NULL=안 읽음 (알림·뱃지 대상)';

-- 기존 대화는 모두 읽은 것으로 처리 (도입 시점 이전 알림 쌓이지 않게)
UPDATE support_ticket_messages
SET read_at = COALESCE(created_at, NOW())
WHERE read_at IS NULL;

COMMIT;


-- ================================================
-- 검증
-- ================================================
-- SELECT author_type, is_internal, read_at IS NULL AS 안읽음, LEFT(content, 20)
--   FROM support_ticket_messages ORDER BY created_at;
