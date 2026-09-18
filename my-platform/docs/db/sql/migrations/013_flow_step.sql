-- ================================================
-- 013_flow_step.sql
-- 메인 플로우 스텝 (고객/본사 동일 code·label)
-- 셀프: building 이후 파란 스텝만 / 대리: 전체
-- 견적은 deposit(선금) 단계에 포함
-- ================================================

INSERT INTO code_groups (group_code, name, description, ref_hint)
SELECT * FROM (VALUES
  (
    'FLOW_STEP',
    '메인 플로우 스텝',
    '셀프·대리 공통 스텝 코드. build_type에 따라 표시 스텝만 다름.',
    'flow_step (UI/로직)'
  )
) AS v(group_code, name, description, ref_hint)
WHERE NOT EXISTS (SELECT 1 FROM code_groups g WHERE g.group_code = v.group_code);

DO $$
DECLARE
  gid UUID;
BEGIN
  SELECT code_group_id INTO gid FROM code_groups WHERE group_code = 'FLOW_STEP';
  IF gid IS NOT NULL THEN
    INSERT INTO common_codes (code_group_id, code, label, description, sort_order)
    SELECT gid, x.code, x.label, x.description, x.sort_order FROM (VALUES
      ('intake',      '대리제작접수',   '대리 전용', 10),
      ('deposit',     '선금',           '대리 전용 · 견적 포함', 20),
      ('building',    '제작',           '셀프·대리', 30),
      ('preview',     '검토',           '셀프·대리', 50),
      ('balance',     '잔금',           '대리 전용', 60),
      ('pay_method',  '카드/계좌 등록', '셀프·대리', 70),
      ('trial',       '체험',           '셀프·대리', 80),
      ('subscribed',  '구독',           '셀프·대리', 90),
      ('suspended',   '정지',           '셀프·대리', 100)
    ) AS x(code, label, description, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM common_codes c WHERE c.code_group_id = gid AND c.code = x.code);
  END IF;
END $$;
