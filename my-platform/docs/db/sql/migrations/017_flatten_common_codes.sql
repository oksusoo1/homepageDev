-- ================================================
-- 017_flatten_common_codes.sql
-- code_groups 제거 · common_codes.group_code 직접 보유
-- ================================================

-- 1) group_code 컬럼 추가
ALTER TABLE common_codes
  ADD COLUMN IF NOT EXISTS group_code VARCHAR(50);

UPDATE common_codes c
SET group_code = g.group_code
FROM code_groups g
WHERE c.code_group_id = g.code_group_id
  AND (c.group_code IS NULL OR c.group_code = '');

-- 혹시 못 채운 행이 있으면 실패시킴
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM common_codes WHERE group_code IS NULL OR group_code = '') THEN
    RAISE EXCEPTION 'common_codes.group_code 채우기 실패 — code_groups 조인 확인';
  END IF;
END $$;

ALTER TABLE common_codes
  ALTER COLUMN group_code SET NOT NULL;

-- 2) 기존 UNIQUE(code_group_id, code) → (group_code, code)
ALTER TABLE common_codes DROP CONSTRAINT IF EXISTS common_codes_code_group_id_code_key;
ALTER TABLE common_codes DROP CONSTRAINT IF EXISTS common_codes_group_code_code_key;
ALTER TABLE common_codes
  ADD CONSTRAINT common_codes_group_code_code_key UNIQUE (group_code, code);

CREATE INDEX IF NOT EXISTS idx_common_codes_group_code ON common_codes(group_code);

-- 3) FK · code_group_id 제거
ALTER TABLE common_codes DROP CONSTRAINT IF EXISTS common_codes_code_group_id_fkey;
ALTER TABLE common_codes DROP COLUMN IF EXISTS code_group_id;

-- 4) code_groups 테이블 삭제
DROP TABLE IF EXISTS code_groups CASCADE;

COMMENT ON COLUMN common_codes.group_code IS '그룹 코드 (예: FLOW_STEP, PAYMENT_METHOD). 구 code_groups.group_code';
COMMENT ON TABLE common_codes IS '공통코드. group_code+code 불변, label/설명/순서/사용만 변경';
