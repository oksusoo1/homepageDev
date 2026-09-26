-- ================================================
-- 029_user_posts_author_auth.sql
-- 비밀글 본인 열람용. 작성 당시 로그인 계정 (NULL = 비로그인 작성)
-- ================================================

ALTER TABLE user_posts
  ADD COLUMN IF NOT EXISTS author_auth_id UUID REFERENCES auth.users(id);

COMMENT ON COLUMN user_posts.author_auth_id IS
  '작성 당시 로그인 계정 → auth.users. NULL=비로그인 작성. 비밀글은 소유 사장님 또는 이 계정만 원문 열람';
