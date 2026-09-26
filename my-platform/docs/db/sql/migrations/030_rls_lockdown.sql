-- ================================================
-- 030_rls_lockdown.sql
-- 브라우저 anon/authenticated 키로 public 테이블을 읽거나 쓰지 못하게 잠근다.
-- service role(본 앱 서버)은 RLS를 우회하므로 영향 없음.
--
-- **코드 배포·E2E 통과 후 실행**
-- agent는 ALTER/CREATE/DROP을 실행하지 않는다. 실행은 사용자가 한다.
-- ================================================

DO $$
DECLARE
  t record;
  p record;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;

  FOR p IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- 테이블·뷰(ALL TABLES에 포함)·시퀀스에서 브라우저 역할 권한 회수
-- service_role 은 건드리지 않는다
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 이후에 만들어지는 테이블·시퀀스에도 anon/authenticated 기본 GRANT 안 함
-- (이 스크립트를 실행한 역할이 만든 객체에 적용)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
