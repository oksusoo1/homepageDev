-- ================================================
-- 020_drop_templates_is_active.sql
-- 템플릿 노출/삭제는 use_flag 단일화 (is_active 중복 제거)
-- ================================================

DROP INDEX IF EXISTS idx_templates_active;

ALTER TABLE templates
  DROP COLUMN IF EXISTS is_active;
