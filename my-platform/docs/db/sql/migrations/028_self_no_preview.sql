-- ================================================
-- 028_self_no_preview.sql
-- 셀프 사이트는 preview(검토) 단계 없음 → building 으로 정리
-- 셀프 흐름: building → pay_method → trial → subscribed
-- ================================================

UPDATE sites
SET status = 'building',
    updated_at = NOW()
WHERE build_type = 'self'
  AND status = 'preview'
  AND use_flag = 1;
