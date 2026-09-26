-- public 스키마 RLS·권한 점검 (조회 전용)
-- 1) 테이블: RLS 활성, 정책 수, anon/authenticated 권한 보유
-- 2) 뷰 목록 (+ 브라우저 역할 권한)
-- 3) anon/authenticated 가 EXECUTE 가능한 함수 (PostgREST RPC 후보)

-- 1. 테이블
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  (
    SELECT count(*)::int
    FROM pg_policy p
    WHERE p.polrelid = c.oid
  ) AS policy_count,
  COALESCE((
    SELECT json_agg(p.polname ORDER BY p.polname)
    FROM pg_policy p
    WHERE p.polrelid = c.oid
  ), '[]'::json) AS policies,
  (
    has_table_privilege('anon', c.oid, 'SELECT')
    OR has_table_privilege('anon', c.oid, 'INSERT')
    OR has_table_privilege('anon', c.oid, 'UPDATE')
    OR has_table_privilege('anon', c.oid, 'DELETE')
    OR has_table_privilege('anon', c.oid, 'TRUNCATE')
  ) AS anon_has_priv,
  (
    has_table_privilege('authenticated', c.oid, 'SELECT')
    OR has_table_privilege('authenticated', c.oid, 'INSERT')
    OR has_table_privilege('authenticated', c.oid, 'UPDATE')
    OR has_table_privilege('authenticated', c.oid, 'DELETE')
    OR has_table_privilege('authenticated', c.oid, 'TRUNCATE')
  ) AS authenticated_has_priv
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;

-- 2. 뷰
SELECT
  c.relname AS view_name,
  (
    has_table_privilege('anon', c.oid, 'SELECT')
    OR has_table_privilege('anon', c.oid, 'INSERT')
    OR has_table_privilege('anon', c.oid, 'UPDATE')
    OR has_table_privilege('anon', c.oid, 'DELETE')
  ) AS anon_has_priv,
  (
    has_table_privilege('authenticated', c.oid, 'SELECT')
    OR has_table_privilege('authenticated', c.oid, 'INSERT')
    OR has_table_privilege('authenticated', c.oid, 'UPDATE')
    OR has_table_privilege('authenticated', c.oid, 'DELETE')
  ) AS authenticated_has_priv
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
ORDER BY c.relname;

-- 3. 브라우저 역할이 실행 가능한 함수 (RPC)
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND (
    has_function_privilege('anon', p.oid, 'EXECUTE')
    OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )
ORDER BY p.proname, 2;
