-- ================================================
-- 012_common_codes_extra.sql
-- BILLING_STATUS, TICKET_PRIORITY, BUSINESS_TYPE (표시용 시드)
-- ================================================

INSERT INTO code_groups (group_code, name, description, ref_hint)
SELECT * FROM (VALUES
  ('BILLING_STATUS', '청구 상태', NULL, 'billing_history.status'),
  ('TICKET_PRIORITY', '수정요청 우선순위', NULL, 'support_tickets.priority'),
  ('BUSINESS_TYPE', '업종', NULL, 'inquiries.business_type')
) AS v(group_code, name, description, ref_hint)
WHERE NOT EXISTS (SELECT 1 FROM code_groups g WHERE g.group_code = v.group_code);

DO $$
DECLARE
  gid UUID;
BEGIN
  SELECT code_group_id INTO gid FROM code_groups WHERE group_code = 'BILLING_STATUS';
  IF gid IS NOT NULL THEN
    INSERT INTO common_codes (code_group_id, code, label, description, sort_order)
    SELECT gid, x.code, x.label, x.description, x.sort_order FROM (VALUES
      ('unpaid', '미납', NULL, 10),
      ('paid', '납부완료', NULL, 20),
      ('overdue', '연체', NULL, 30)
    ) AS x(code, label, description, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM common_codes c WHERE c.code_group_id = gid AND c.code = x.code);
  END IF;

  SELECT code_group_id INTO gid FROM code_groups WHERE group_code = 'TICKET_PRIORITY';
  IF gid IS NOT NULL THEN
    INSERT INTO common_codes (code_group_id, code, label, description, sort_order)
    SELECT gid, x.code, x.label, x.description, x.sort_order FROM (VALUES
      ('low', '낮음', NULL, 10),
      ('normal', '보통', NULL, 20),
      ('high', '높음', NULL, 30),
      ('urgent', '긴급', NULL, 40)
    ) AS x(code, label, description, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM common_codes c WHERE c.code_group_id = gid AND c.code = x.code);
  END IF;

  SELECT code_group_id INTO gid FROM code_groups WHERE group_code = 'BUSINESS_TYPE';
  IF gid IS NOT NULL THEN
    INSERT INTO common_codes (code_group_id, code, label, description, sort_order)
    SELECT gid, x.code, x.label, x.description, x.sort_order FROM (VALUES
      ('cafe', '카페', NULL, 10),
      ('restaurant', '식당', NULL, 20),
      ('salon', '미용실', NULL, 30),
      ('clinic', '병원', NULL, 40),
      ('academy', '학원', NULL, 50),
      ('general', '일반', NULL, 60),
      ('etc', '기타', NULL, 70)
    ) AS x(code, label, description, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM common_codes c WHERE c.code_group_id = gid AND c.code = x.code);
  END IF;
END $$;
