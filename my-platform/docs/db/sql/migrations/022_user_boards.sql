-- ================================================
-- 022_user_boards.sql
-- 게시판 통합: 사이트당 여러 게시판 · 게시글 · 댓글(사장님 답변)
--   user_boards   (신규) 게시판 정의 — board_type: notice | qna | general
--   user_posts    (변경) + user_board_id · author_type · is_private · phone · email · updated_at
--   user_comments (신규) 댓글 — 사장님 답변도 댓글 (author_type = owner)
--   user_messages (삭제) → '문의하기'(qna) 게시판 글 + 답변 댓글로 이관
-- 새 사이트: 트리거로 기본 게시판(공지사항·문의하기) 자동 생성
-- 주체: owner = 사장님(customers) · user = 고객(방문자)
-- ================================================

BEGIN;

-- ------------------------------------------------
-- 1. user_boards
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS user_boards (
  user_board_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID NOT NULL REFERENCES sites(site_id) ON DELETE RESTRICT,
  board_key     VARCHAR(50) NOT NULL,              -- URL: /s/{code}/board/{board_key}
  name          VARCHAR(100) NOT NULL,
  -- board_type: notice(공지·사장님만 작성) | qna(문의·비밀글·답변 필요) | general(일반·고객 작성)
  board_type    VARCHAR(20) NOT NULL DEFAULT 'general'
                CHECK (board_type IN ('notice', 'qna', 'general')),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  use_flag      SMALLINT NOT NULL DEFAULT 1 CHECK (use_flag IN (0, 1)),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- 같은 사이트 안에서 board_key 중복 금지 (삭제분 제외)
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_boards_site_key
  ON user_boards(site_id, board_key) WHERE use_flag = 1;
CREATE INDEX IF NOT EXISTS idx_user_boards_site_id  ON user_boards(site_id);
CREATE INDEX IF NOT EXISTS idx_user_boards_use_flag ON user_boards(use_flag);

ALTER TABLE user_boards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_boards_all" ON user_boards;
CREATE POLICY "user_boards_all" ON user_boards FOR ALL USING (true);

COMMENT ON TABLE  user_boards IS '고객(방문자) 사이트 게시판 정의. 사이트당 여러 개';
COMMENT ON COLUMN user_boards.user_board_id IS 'PK';
COMMENT ON COLUMN user_boards.site_id IS '사이트 → sites';
COMMENT ON COLUMN user_boards.board_key IS 'URL 식별자 (사이트 내 유일). 예: notice, qna';
COMMENT ON COLUMN user_boards.name IS '게시판 표시명';
COMMENT ON COLUMN user_boards.board_type IS 'notice(공지·사장님만 작성) | qna(문의·비밀글·답변 필요) | general(일반)';
COMMENT ON COLUMN user_boards.sort_order IS '메뉴 정렬 (작을수록 앞)';
COMMENT ON COLUMN user_boards.use_flag IS '1=사용 · 0=삭제';
COMMENT ON COLUMN user_boards.created_at IS '생성 시각';
COMMENT ON COLUMN user_boards.updated_at IS '수정 시각';

-- 기존 사이트 전부 기본 게시판 2개 생성
INSERT INTO user_boards (site_id, board_key, name, board_type, sort_order)
SELECT s.site_id, b.board_key, b.name, b.board_type, b.sort_order
FROM sites s
CROSS JOIN (VALUES
  ('notice', '공지사항', 'notice', 1),
  ('qna',    '문의하기', 'qna',    2)
) AS b(board_key, name, board_type, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM user_boards ub
  WHERE ub.site_id = s.site_id AND ub.board_key = b.board_key AND ub.use_flag = 1
);

-- 새 사이트 → 기본 게시판 자동 생성
CREATE OR REPLACE FUNCTION create_default_user_boards()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_boards (site_id, board_key, name, board_type, sort_order) VALUES
    (NEW.site_id, 'notice', '공지사항', 'notice', 1),
    (NEW.site_id, 'qna',    '문의하기', 'qna',    2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_default_user_boards ON sites;
CREATE TRIGGER trg_create_default_user_boards
AFTER INSERT ON sites
FOR EACH ROW EXECUTE FUNCTION create_default_user_boards();


-- ------------------------------------------------
-- 2. user_posts 확장
-- ------------------------------------------------
ALTER TABLE user_posts
  ADD COLUMN IF NOT EXISTS user_board_id UUID REFERENCES user_boards(user_board_id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS author_type   VARCHAR(10) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS is_private    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS email         VARCHAR(200),
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMP DEFAULT NOW();

ALTER TABLE user_posts DROP CONSTRAINT IF EXISTS user_posts_author_type_check;
ALTER TABLE user_posts
  ADD CONSTRAINT user_posts_author_type_check CHECK (author_type IN ('owner', 'user'));

-- 기존 글 = 사장님이 쓴 게시판 글 → 공지사항
UPDATE user_posts p
SET user_board_id = ub.user_board_id,
    author_type   = 'owner'
FROM user_boards ub
WHERE p.user_board_id IS NULL
  AND ub.site_id = p.site_id
  AND ub.board_key = 'notice'
  AND ub.use_flag = 1;


-- ------------------------------------------------
-- 3. user_comments
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS user_comments (
  user_comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID NOT NULL REFERENCES user_posts(post_id) ON DELETE RESTRICT,
  author_type     VARCHAR(10) NOT NULL DEFAULT 'owner'
                  CHECK (author_type IN ('owner', 'user')),
  author          VARCHAR(100) NOT NULL DEFAULT '운영자',
  content         TEXT NOT NULL,
  use_flag        SMALLINT NOT NULL DEFAULT 1 CHECK (use_flag IN (0, 1)),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_comments_post_id  ON user_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_user_comments_use_flag ON user_comments(use_flag);

ALTER TABLE user_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_comments_all" ON user_comments;
CREATE POLICY "user_comments_all" ON user_comments FOR ALL USING (true);

COMMENT ON TABLE  user_comments IS '게시글 댓글. 사장님 답변 = author_type owner';
COMMENT ON COLUMN user_comments.user_comment_id IS 'PK';
COMMENT ON COLUMN user_comments.post_id IS '게시글 → user_posts';
COMMENT ON COLUMN user_comments.author_type IS 'owner(사장님) | user(고객)';
COMMENT ON COLUMN user_comments.author IS '작성자 표시명';
COMMENT ON COLUMN user_comments.content IS '댓글 내용';
COMMENT ON COLUMN user_comments.use_flag IS '1=사용 · 0=삭제';
COMMENT ON COLUMN user_comments.created_at IS '작성 시각';
COMMENT ON COLUMN user_comments.updated_at IS '수정 시각';


-- ------------------------------------------------
-- 4. user_messages → 문의하기(qna) 게시판 이관
-- ------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.user_messages') IS NOT NULL THEN

    -- 문의 → 게시글 (PK 재사용: user_message_id → post_id, 답변 이관에 사용)
    INSERT INTO user_posts (
      post_id, site_id, user_board_id, title, content, author,
      author_type, is_private, phone, email, use_flag, created_at, updated_at
    )
    SELECT
      m.user_message_id, m.site_id, ub.user_board_id,
      LEFT(REGEXP_REPLACE(m.content, '\s+', ' ', 'g'), 40),
      m.content, m.name,
      'user', m.is_private, m.phone, m.email, m.use_flag,
      m.created_at, COALESCE(m.updated_at, m.created_at)
    FROM user_messages m
    JOIN user_boards ub
      ON ub.site_id = m.site_id AND ub.board_key = 'qna' AND ub.use_flag = 1
    ON CONFLICT (post_id) DO NOTHING;

    -- 답변 → 사장님 댓글
    INSERT INTO user_comments (post_id, author_type, author, content, created_at, updated_at)
    SELECT m.user_message_id, 'owner', '운영자', m.reply_content,
           COALESCE(m.replied_at, m.updated_at, m.created_at),
           COALESCE(m.replied_at, m.updated_at, m.created_at)
    FROM user_messages m
    WHERE m.reply_content IS NOT NULL AND m.reply_content <> ''
      AND EXISTS (SELECT 1 FROM user_posts p WHERE p.post_id = m.user_message_id);

    DROP TABLE user_messages CASCADE;
  END IF;
END $$;

-- 이관 후 게시판 필수
ALTER TABLE user_posts ALTER COLUMN user_board_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_posts_board_id ON user_posts(user_board_id);

COMMENT ON COLUMN user_posts.user_board_id IS '게시판 → user_boards';
COMMENT ON COLUMN user_posts.author_type IS 'owner(사장님) | user(고객)';
COMMENT ON COLUMN user_posts.is_private IS 'true=비밀글 (공개 목록에서 본문 숨김, 사장님만 열람)';
COMMENT ON COLUMN user_posts.phone IS '고객 연락처 (공개 안 함)';
COMMENT ON COLUMN user_posts.email IS '고객 이메일 (공개 안 함)';
COMMENT ON COLUMN user_posts.updated_at IS '수정 시각';


-- ------------------------------------------------
-- 5. 공통코드
-- ------------------------------------------------
UPDATE common_codes SET use_flag = 0, updated_at = NOW()
WHERE group_code = 'USER_MSG_STATUS';

INSERT INTO common_codes (group_code, code, label, description, sort_order) VALUES
  ('BOARD_TYPE', 'notice',  '공지', '사장님만 작성',            1),
  ('BOARD_TYPE', 'qna',     '문의', '고객 작성 · 비밀글 · 답변 필요', 2),
  ('BOARD_TYPE', 'general', '일반', '고객 작성',               3)
ON CONFLICT (group_code, code) DO NOTHING;

COMMIT;


-- ================================================
-- 검증
-- ================================================
-- SELECT s.subdomain, ub.board_key, ub.name, ub.board_type
--   FROM user_boards ub JOIN sites s ON s.site_id = ub.site_id ORDER BY 1, ub.sort_order;
-- SELECT ub.board_key, p.title, p.author, p.author_type, p.is_private
--   FROM user_posts p JOIN user_boards ub ON ub.user_board_id = p.user_board_id;
-- SELECT * FROM user_comments;
-- SELECT to_regclass('public.user_messages');   -- NULL 이어야 함
