-- public 테이블 RLS 활성 여부와 남은 정책
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  COALESCE((
    SELECT json_agg(p.polname ORDER BY p.polname)
    FROM pg_policy p
    WHERE p.polrelid = c.oid
  ), '[]'::json) AS policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;
