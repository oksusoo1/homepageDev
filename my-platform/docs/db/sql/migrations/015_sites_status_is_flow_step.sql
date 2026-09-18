-- ================================================
-- 015_sites_status_is_flow_step.sql
-- sites.status = FLOW_STEP (진도·공개의 유일한 상태)
-- inquiries.status / deploy_status / subscriptions.status 는 앱에서 미사용
-- sync_site_status 트리거 제거 (site가 SSOT)
-- ================================================

-- 1) 구독→사이트 덮어쓰기 트리거 제거
DROP TRIGGER IF EXISTS trg_sync_site_status ON subscriptions;

-- 2) status CHECK 완화 후 이관
ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_status_check;

-- 3) 기존 행 → FLOW_STEP 코드로 이관
UPDATE sites s
SET
  status = CASE
    -- 운영 정지/해지
    WHEN s.status IN ('suspended', 'cancelled') THEN 'suspended'

    -- 구독 우선
    WHEN EXISTS (
      SELECT 1 FROM subscriptions sub
      WHERE sub.site_id = s.site_id AND sub.use_flag = 1 AND sub.status = 'active'
    ) THEN 'subscribed'
    WHEN EXISTS (
      SELECT 1 FROM subscriptions sub
      WHERE sub.site_id = s.site_id AND sub.use_flag = 1 AND sub.status = 'trial'
    ) THEN 'trial'

    -- 대리: 문의 status 기준
    WHEN s.build_type = 'managed' AND s.inquiry_id IS NOT NULL THEN
      CASE (SELECT i.status FROM inquiries i WHERE i.inquiry_id = s.inquiry_id AND i.use_flag = 1)
        WHEN 'received' THEN 'intake'
        WHEN 'reviewing' THEN 'deposit'
        WHEN 'building' THEN
          CASE WHEN s.status IN ('review', 'published') THEN 'preview' ELSE 'building' END
        WHEN 'review' THEN
          CASE WHEN EXISTS (
            SELECT 1 FROM one_time_payments otp
            WHERE otp.customer_id = s.customer_id
              AND otp.type = 'dev_fee'
              AND otp.status = 'pending_confirm'
              AND otp.use_flag = 1
              AND (otp.site_id = s.site_id OR otp.site_id IS NULL)
          ) THEN 'balance' ELSE 'preview' END
        WHEN 'approved' THEN 'pay_method'
        WHEN 'done' THEN 'pay_method'
        ELSE COALESCE(
          CASE s.status
            WHEN 'draft' THEN 'building'
            WHEN 'review' THEN 'preview'
            WHEN 'published' THEN 'pay_method'
            ELSE NULL
          END,
          'intake'
        )
      END

    -- 셀프 / 문의 없음
    WHEN s.status = 'draft' THEN 'building'
    WHEN s.status = 'review' THEN 'preview'
    WHEN s.status = 'published' THEN 'pay_method'

    -- 이미 FLOW 코드면 유지
    WHEN s.status IN (
      'intake','deposit','building','preview','balance',
      'pay_method','trial','subscribed','suspended'
    ) THEN s.status

    ELSE 'building'
  END,
  updated_at = NOW();

-- 4) FLOW_STEP 만 허용
ALTER TABLE sites
  ADD CONSTRAINT sites_status_check
  CHECK (status IN (
    'intake', 'deposit', 'building', 'preview', 'balance',
    'pay_method', 'trial', 'subscribed', 'suspended'
  ));

COMMENT ON COLUMN sites.status IS 'FLOW_STEP — 진도·공개의 유일한 상태 코드';

-- 5) 안 쓰는 공통코드 그룹 OFF (표시는 FLOW_STEP 사용)
UPDATE code_groups
SET use_flag = 0, updated_at = NOW()
WHERE group_code IN ('SITE_STATUS', 'DEPLOY_STATUS', 'SUB_STATUS', 'INQUIRY_STATUS')
  AND use_flag = 1;

UPDATE common_codes c
SET use_flag = 0, updated_at = NOW()
FROM code_groups g
WHERE c.code_group_id = g.code_group_id
  AND g.group_code IN ('SITE_STATUS', 'DEPLOY_STATUS', 'SUB_STATUS', 'INQUIRY_STATUS')
  AND c.use_flag = 1;

-- FLOW_STEP 은 ON 유지 (done_build 제외)
UPDATE common_codes c
SET use_flag = 1, updated_at = NOW()
FROM code_groups g
WHERE c.code_group_id = g.code_group_id
  AND g.group_code = 'FLOW_STEP'
  AND c.code <> 'done_build';

UPDATE code_groups
SET use_flag = 1, updated_at = NOW()
WHERE group_code = 'FLOW_STEP';
