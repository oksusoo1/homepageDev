-- sites.status에 검수용 공개(review) 추가 (플로우 v1.3.2)
-- managed: 본사 검수용 공개 → 고객·staff만 /s/{code} 접근

ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_status_check;

ALTER TABLE sites ADD CONSTRAINT sites_status_check
  CHECK (status IN ('draft', 'review', 'published', 'suspended', 'cancelled'));
