-- ================================================
-- 027_ticket_quote.sql
-- 운영 중 사이트의 추가 작업 = 고객 요청에 붙는 유료 견적
--   one_time_payments.ticket_id : 어느 요청의 청구인지 (type='extra')
-- 흐름: 사장님 요청 → 직원이 무료/유료 판단 → 유료면 견적(extra 결제행) → 결제 → 작업 → 완료
-- ※ 사이트 진행 상태(sites.status)는 건드리지 않는다 — 구독 중 사이트를 제작 단계로 되돌리지 않음
-- ================================================

BEGIN;

ALTER TABLE one_time_payments
  ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES support_tickets(ticket_id);

CREATE INDEX IF NOT EXISTS idx_one_time_ticket ON one_time_payments(ticket_id);

COMMENT ON COLUMN one_time_payments.ticket_id IS '연결된 고객 요청 → support_tickets (type=extra 유료 작업 견적)';

COMMIT;


-- ================================================
-- 검증
-- ================================================
-- SELECT t.title, p.amount, p.status, p.note
--   FROM one_time_payments p JOIN support_tickets t ON t.ticket_id = p.ticket_id
--   WHERE p.use_flag = 1;
