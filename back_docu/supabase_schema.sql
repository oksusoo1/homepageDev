-- ================================================
-- Supabase SQL Editor에서 순서대로 실행하세요
-- ================================================

-- 1. 사이트 테이블 (판매자가 개설한 고객 사이트)
CREATE TABLE sites (
  id          SERIAL PRIMARY KEY,
  site_id     VARCHAR(50) UNIQUE NOT NULL,   -- 고유 식별자 (예: 'abc123')
  name        VARCHAR(200) NOT NULL,          -- 사이트 이름 (예: '홍길동 법무사')
  domain      VARCHAR(200) UNIQUE,            -- 커스텀 도메인 (예: 'mybusiness.com')
  subdomain   VARCHAR(100) UNIQUE NOT NULL,   -- 서브도메인 (예: 'hong')
  description TEXT,                           -- 회사 소개
  address     VARCHAR(300),                   -- 주소
  phone       VARCHAR(50),                    -- 전화번호
  email       VARCHAR(200),                   -- 이메일
  owner_email VARCHAR(200) NOT NULL,          -- 판매자 이메일
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 2. 게시판 테이블
CREATE TABLE posts (
  id          SERIAL PRIMARY KEY,
  site_id     VARCHAR(50) NOT NULL REFERENCES sites(site_id),
  title       VARCHAR(500) NOT NULL,
  content     TEXT NOT NULL,
  author      VARCHAR(100) NOT NULL DEFAULT '익명',
  created_at  TIMESTAMP DEFAULT NOW()
);

-- 3. 인덱스 (조회 성능)
CREATE INDEX idx_posts_site_id ON posts(site_id);
CREATE INDEX idx_sites_subdomain ON sites(subdomain);
CREATE INDEX idx_sites_domain ON sites(domain);

-- ================================================
-- 테스트 데이터 (개발용)
-- ================================================

-- 테스트 사이트 1개 삽입
INSERT INTO sites (site_id, name, subdomain, description, address, phone, email, owner_email)
VALUES (
  'testsite01',
  '홍길동 법무사 사무소',
  'hong',
  '20년 경력의 법무사가 직접 상담해드립니다. 부동산 등기, 법인 설립, 각종 계약서 작성을 전문으로 합니다.',
  '서울시 강남구 테헤란로 123, 456호',
  '02-1234-5678',
  'hong@example.com',
  'seller@myplatform.com'
);

-- 테스트 게시글 3개 삽입
INSERT INTO posts (site_id, title, content, author) VALUES
('testsite01', '사무소 소개', '안녕하세요. 홍길동 법무사 사무소입니다. 부동산 등기 및 법인 설립 전문입니다.', '관리자'),
('testsite01', '부동산 등기 서비스 안내', '매매, 증여, 상속 등기를 신속하게 처리해드립니다. 문의는 전화나 이메일로 해주세요.', '관리자'),
('testsite01', '연말 휴무 안내', '12월 31일부터 1월 2일까지 휴무입니다. 긴급한 경우 이메일로 연락 바랍니다.', '관리자');

-- ================================================
-- RLS (Row Level Security) 설정
-- 누구나 읽기 가능, 쓰기도 허용 (로그인 없음)
-- ================================================
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 허용
CREATE POLICY "sites_select" ON sites FOR SELECT USING (true);
CREATE POLICY "posts_select" ON posts FOR SELECT USING (true);

-- 누구나 게시글 작성 허용 (로그인 없음)
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (true);

-- 사이트 생성은 서비스 키로만 (API에서 처리)
CREATE POLICY "sites_insert" ON sites FOR INSERT WITH CHECK (true);
