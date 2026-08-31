-- ================================================
-- sample_data_v2.sql
-- schema_v2.1_2026-08-31.sql (또는 supabase_schema_mvp_v2.sql) 실행 후 실행
-- 경로: docs/db/sql/sample/
-- ================================================


-- ================================================
-- 1. customers
-- ================================================

INSERT INTO customers (customer_id, email, name, phone, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'hong@cafe.com',   '홍길동', '010-1111-2222', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'kim@salon.com',   '김미용', '010-3333-4444', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'lee@clinic.com',  '이원장', '010-5555-6666', 'active');


-- ================================================
-- 2. sites
-- ================================================

INSERT INTO sites (
  site_id, site_code, customer_id, template_id,
  name, subdomain, domain,
  description, address, phone, email,
  build_type, status, deploy_status
) VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'hongcafe_001',
    '11111111-1111-1111-1111-111111111111',
    (SELECT template_id FROM templates WHERE category = 'cafe' LIMIT 1),
    '홍길동 카페', 'hongcafe', NULL,
    '강남구 최고의 스페셜티 커피 카페',
    '서울시 강남구 테헤란로 123, 1층',
    '02-1234-5678', 'hello@hongcafe.com',
    'self', 'published', 'live'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'kimsalon_001',
    '22222222-2222-2222-2222-222222222222',
    (SELECT template_id FROM templates WHERE category = 'salon' LIMIT 1),
    '김미용실', 'kimsalon', 'kimsalon.com',
    '20년 경력의 헤어 디자이너가 직접 시술',
    '서울시 마포구 홍대입구역 2번 출구',
    '02-9999-8888', 'info@kimsalon.com',
    'managed', 'published', 'live'
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'leeclinic_001',
    '33333333-3333-3333-3333-333333333333',
    (SELECT template_id FROM templates WHERE category = 'clinic' LIMIT 1),
    '이원장 내과의원', 'leeclinic', NULL,
    '지역 주민을 위한 따뜻한 내과 의원',
    '서울시 송파구 잠실동 456번지',
    '02-7777-6666', NULL,
    'self', 'draft', 'pending'
  );


-- ================================================
-- 3. one_time_payments
-- ================================================

INSERT INTO one_time_payments (customer_id, site_id, type, amount, status, note, paid_at) VALUES
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'dev_fee',      500000, 'paid',   '미용실 홈페이지 기본 제작 (5페이지)', NOW() - INTERVAL '20 days'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'domain_setup',  50000, 'paid',   'kimsalon.com 도메인 연결 대행',       NOW() - INTERVAL '18 days'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'domain_setup',  50000, 'unpaid', 'hongcafe.com 도메인 연결 대행 예정',   NULL),
  ('33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'dev_fee',      300000, 'unpaid', '내과 홈페이지 기본 제작 (3페이지)',    NULL);


-- ================================================
-- 4. customer_payment_methods
-- ================================================

INSERT INTO customer_payment_methods (customer_id, pg_provider, pg_customer_id, card_last4, card_brand, card_name, is_default, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'toss', 'BILLING_KEY_hong_abc123', '4242', 'kakao',   '카카오페이', true, true),
  ('22222222-2222-2222-2222-222222222222', 'toss', 'BILLING_KEY_kim_xyz789',  '8888', 'shinhan', '신한카드',   true, true);


-- ================================================
-- 5. subscriptions
-- ================================================

INSERT INTO subscriptions (customer_id, site_id, amount, billing_day, payment_method, status, started_at, next_billing_date) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    30000, 1, 'manual', 'active',
    NOW() - INTERVAL '60 days', '2026-04-01'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    30000, 5, 'card', 'active',
    NOW() - INTERVAL '30 days', '2026-04-05'
  );


-- ================================================
-- 6. billing_history
-- ================================================

INSERT INTO billing_history (subscription_id, period, amount, status, payment_method, paid_at, note) VALUES
  (
    (SELECT subscription_id FROM subscriptions WHERE customer_id = '11111111-1111-1111-1111-111111111111'),
    '2026-01', 30000, 'paid', 'manual', '2026-01-03 10:00:00', '계좌이체 확인'
  ),
  (
    (SELECT subscription_id FROM subscriptions WHERE customer_id = '11111111-1111-1111-1111-111111111111'),
    '2026-02', 30000, 'paid', 'manual', '2026-02-04 14:30:00', '계좌이체 확인'
  ),
  (
    (SELECT subscription_id FROM subscriptions WHERE customer_id = '11111111-1111-1111-1111-111111111111'),
    '2026-03', 30000, 'unpaid', 'manual', NULL, NULL
  ),
  (
    (SELECT subscription_id FROM subscriptions WHERE customer_id = '22222222-2222-2222-2222-222222222222'),
    '2026-03', 30000, 'paid', 'card', '2026-03-05 00:01:00', 'toss_tx_20260305_kim001'
  );


-- ================================================
-- 7. support_tickets
-- ================================================

INSERT INTO support_tickets (
  site_id, customer_id,
  title, content, category,
  status, priority,
  deadline_days, deadline_at, resolved_at
) VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '영업시간 수정 요청', '영업시간을 오전 9시~오후 10시로 변경해주세요.',
    'text_change', 'resolved', 'normal',
    3, NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '메뉴 이미지 교체', '아메리카노, 라떼 사진 교체 부탁드립니다.',
    'image', 'in_progress', 'normal',
    3, NOW() + INTERVAL '1 days', NULL
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    '예약 페이지 추가', '카카오 예약 링크를 메인에 추가하고 싶습니다.',
    'page_add', 'open', 'high',
    3, NOW() + INTERVAL '2 days', NULL
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    '전화번호 오타 수정 (긴급)', '02-9999-8887 → 02-9999-8888로 수정해주세요.',
    'text_change', 'open', 'urgent',
    3, NOW() - INTERVAL '1 days', NULL  -- 기한 초과
  );


-- ================================================
-- 8. posts
-- ================================================

INSERT INTO posts (site_id, title, content, author) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '카페 오픈 안내',    '홍길동 카페가 새롭게 오픈했습니다!',               '관리자'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '봄 신메뉴 출시',    '딸기 라떼, 벚꽃 에이드를 새롭게 출시합니다.',     '관리자'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '주차 안내',         '지하 1층 주차장 이용 가능. 1시간 무료.',           '관리자'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '3월 예약 오픈',     '3월 예약이 오픈되었습니다. 카카오톡으로 예약.',    '원장'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '봄 염색 이벤트',    '3월 한 달간 염색 시술 20% 할인 이벤트.',          '원장');


-- ================================================
-- 확인용 조회
-- ================================================

SELECT
  s.name          AS 사이트명,
  s.site_code     AS 사이트코드,
  s.subdomain     AS 서브도메인,
  s.status        AS 사이트상태,
  s.build_type    AS 개발유형,
  c.name          AS 고객명,
  c.email         AS 이메일,
  sub.amount      AS 월구독료,
  sub.status      AS 구독상태,
  sub.payment_method  AS 결제방식,
  sub.next_billing_date AS 다음청구일
FROM sites s
LEFT JOIN customers c       ON s.customer_id = c.customer_id
LEFT JOIN subscriptions sub ON sub.site_id   = s.site_id
ORDER BY s.created_at DESC;
