-- ================================================
-- 023_support_tickets_reply.sql
-- 고객 요청(수정요청) 처리 결과를 고객에게 전달
--   + reply_content  본사 답변 (완료 시 필수)
--   + replied_at     답변 시각
--   + handled_by     담당 직원 → staff
-- 상태만 바꾸던 처리시작/완료 → 답변·담당자와 함께 기록
-- ================================================

BEGIN;

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS reply_content TEXT,
  ADD COLUMN IF NOT EXISTS replied_at    TIMESTAMP,
  ADD COLUMN IF NOT EXISTS handled_by    UUID REFERENCES staff(staff_id);

CREATE INDEX IF NOT EXISTS idx_tickets_handled_by ON support_tickets(handled_by);

COMMENT ON COLUMN support_tickets.reply_content IS '본사 답변 (고객 화면·알림에 표시). 완료 처리 시 필수';
COMMENT ON COLUMN support_tickets.replied_at IS '답변 시각';
COMMENT ON COLUMN support_tickets.handled_by IS '담당 직원 → staff';

-- 기존 완료 건: 답변 없음 표시 (고객 화면에서 "답변 없이 완료" 로 보이지 않게 안내 문구)
UPDATE support_tickets
SET reply_content = '처리 완료되었습니다.',
    replied_at = COALESCE(resolved_at, updated_at, NOW())
WHERE status = 'resolved'
  AND reply_content IS NULL;

COMMIT;


-- ================================================
-- 검증
-- ================================================
-- SELECT title, status, handled_by, replied_at, LEFT(reply_content, 30)
--   FROM support_tickets ORDER BY created_at DESC;
