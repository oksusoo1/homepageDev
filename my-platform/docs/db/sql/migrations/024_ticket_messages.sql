-- ================================================
-- 024_ticket_messages.sql
-- 고객 요청(support_tickets) 대화 — 사장님 ↔ 직원 주고받기 + 직원 내부 메모
--   support_ticket_messages
--     author_type : customer(사장님) | staff(직원)
--     is_internal : true = 직원 내부 메모 (고객 화면에 절대 노출 안 함)
-- ※ 화면에서 내부 메모는 "체크박스"가 아니라 **입력칸 자체를 분리** — 실수로 고객에게 보내지 않도록
-- ================================================

BEGIN;

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  ticket_message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         UUID NOT NULL REFERENCES support_tickets(ticket_id) ON DELETE RESTRICT,
  -- author_type: customer(사장님) | staff(직원)
  author_type       VARCHAR(10) NOT NULL
                    CHECK (author_type IN ('customer', 'staff')),
  author            VARCHAR(100) NOT NULL DEFAULT '',
  content           TEXT NOT NULL,
  -- is_internal: true = 직원끼리 보는 메모. customer 글은 항상 false
  is_internal       BOOLEAN NOT NULL DEFAULT false,
  use_flag          SMALLINT NOT NULL DEFAULT 1 CHECK (use_flag IN (0, 1)),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),

  CONSTRAINT chk_internal_staff_only
    CHECK (is_internal = false OR author_type = 'staff')
);

CREATE INDEX IF NOT EXISTS idx_ticket_msgs_ticket   ON support_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_msgs_internal ON support_ticket_messages(is_internal);
CREATE INDEX IF NOT EXISTS idx_ticket_msgs_use_flag ON support_ticket_messages(use_flag);

ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ticket_messages_all" ON support_ticket_messages;
CREATE POLICY "ticket_messages_all" ON support_ticket_messages FOR ALL USING (true);

COMMENT ON TABLE  support_ticket_messages IS '고객 요청 대화 — 사장님↔직원. is_internal=true 는 직원 전용 메모';
COMMENT ON COLUMN support_ticket_messages.ticket_message_id IS 'PK';
COMMENT ON COLUMN support_ticket_messages.ticket_id IS '요청 → support_tickets';
COMMENT ON COLUMN support_ticket_messages.author_type IS 'customer(사장님) | staff(직원)';
COMMENT ON COLUMN support_ticket_messages.author IS '작성자 표시명';
COMMENT ON COLUMN support_ticket_messages.content IS '대화 내용';
COMMENT ON COLUMN support_ticket_messages.is_internal IS 'true=직원 내부 메모 (고객 화면 비노출). 직원 글만 가능';
COMMENT ON COLUMN support_ticket_messages.use_flag IS '1=사용 · 0=삭제';

-- 기존 본사 답변(023)을 대화 첫 메시지로 옮김
INSERT INTO support_ticket_messages (ticket_id, author_type, author, content, is_internal, created_at, updated_at)
SELECT t.ticket_id, 'staff', '본사', t.reply_content, false,
       COALESCE(t.replied_at, t.updated_at, NOW()), COALESCE(t.replied_at, t.updated_at, NOW())
FROM support_tickets t
WHERE t.reply_content IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM support_ticket_messages m
    WHERE m.ticket_id = t.ticket_id AND m.author_type = 'staff' AND m.content = t.reply_content
  );

COMMIT;


-- ================================================
-- 검증
-- ================================================
-- SELECT t.title, m.author_type, m.is_internal, LEFT(m.content, 30)
--   FROM support_ticket_messages m JOIN support_tickets t ON t.ticket_id = m.ticket_id
--   ORDER BY m.created_at;
