-- one_time_payments: 입금 신청 후 본사 확인 대기 상태 추가
-- unpaid(미납) | pending_confirm(입금확인대기) | paid(납부완료)

ALTER TABLE one_time_payments DROP CONSTRAINT IF EXISTS one_time_payments_status_check;

ALTER TABLE one_time_payments ADD CONSTRAINT one_time_payments_status_check
  CHECK (status IN ('unpaid', 'pending_confirm', 'paid'));

-- 기존 "잔금 입금 신청" 메모가 있는 unpaid → pending_confirm
UPDATE one_time_payments
SET status = 'pending_confirm'
WHERE status = 'unpaid'
  AND note ILIKE '%입금 신청%';
