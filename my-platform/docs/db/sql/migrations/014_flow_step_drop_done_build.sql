-- ================================================
-- 014_flow_step_drop_done_build.sql
-- FLOW_STEP 에서 완료(done_build) 제거
-- 제작(building) 다음 = 검토(preview)
-- ================================================

-- 공통코드 done_build 비활성 (테이블에 use_flag 있으면)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'common_codes' AND column_name = 'use_flag'
  ) THEN
    UPDATE common_codes c
    SET use_flag = 0
    FROM code_groups g
    WHERE c.code_group_id = g.code_group_id
      AND g.group_code = 'FLOW_STEP'
      AND c.code = 'done_build';
  ELSE
    DELETE FROM common_codes c
    USING code_groups g
    WHERE c.code_group_id = g.code_group_id
      AND g.group_code = 'FLOW_STEP'
      AND c.code = 'done_build';
  END IF;
END $$;

-- 셀프에도 검토(preview) 쓰므로 설명 갱신 (있으면)
UPDATE common_codes c
SET description = '셀프·대리',
    sort_order = 50
FROM code_groups g
WHERE c.code_group_id = g.code_group_id
  AND g.group_code = 'FLOW_STEP'
  AND c.code = 'preview';
