-- ================================================
-- 008_rename_posts_to_user_posts.sql
-- posts → user_posts (사용자 사이트 게시판)
--
-- 주체: user = 사용자(방문자) — 공개 사이트 전용 테이블에 user_ 접두
-- PK 컬럼 post_id 는 URL(/board/[post_id])·기존 코드 호환을 위해 유지
-- ================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'posts'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_posts'
  ) THEN
    ALTER TABLE posts RENAME TO user_posts;
  END IF;
END $$;

-- 인덱스 이름 정리 (있으면 있으면만)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_posts_site_id') THEN
    ALTER INDEX idx_posts_site_id RENAME TO idx_user_posts_site_id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_posts_use_flag') THEN
    ALTER INDEX idx_posts_use_flag RENAME TO idx_user_posts_use_flag;
  END IF;
END $$;

-- RLS 정책 이름 정리
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_posts' AND policyname = 'posts_all'
  ) THEN
    ALTER POLICY "posts_all" ON user_posts RENAME TO "user_posts_all";
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_posts' AND policyname = 'user_posts_all'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_posts'
  ) THEN
    CREATE POLICY "user_posts_all" ON user_posts FOR ALL USING (true);
  END IF;
END $$;

COMMENT ON TABLE user_posts IS
  '사용자(방문자) 사이트 게시판. PK는 post_id 유지(URL 호환)';

-- ================================================
-- 검증
-- ================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name IN ('posts', 'user_posts');
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'user_posts' ORDER BY ordinal_position;
