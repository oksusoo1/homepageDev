-- ================================================
-- 006_add_use_flag.sql
-- Soft delete: use_flag 1=사용(살아있음) · 0=삭제
-- status = 업무 상태 / use_flag = 데이터 사용여부 (조회 시 기본 use_flag = 1)
-- ================================================

-- customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS use_flag SMALLINT NOT NULL DEFAULT 1
  CHECK (use_flag IN (0, 1));
CREATE INDEX IF NOT EXISTS idx_customers_use_flag ON customers(use_flag);

-- staff
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS use_flag SMALLINT NOT NULL DEFAULT 1
  CHECK (use_flag IN (0, 1));
CREATE INDEX IF NOT EXISTS idx_staff_use_flag ON staff(use_flag);

-- templates
ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS use_flag SMALLINT NOT NULL DEFAULT 1
  CHECK (use_flag IN (0, 1));
CREATE INDEX IF NOT EXISTS idx_templates_use_flag ON templates(use_flag);

-- sites
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS use_flag SMALLINT NOT NULL DEFAULT 1
  CHECK (use_flag IN (0, 1));
CREATE INDEX IF NOT EXISTS idx_sites_use_flag ON sites(use_flag);

-- inquiries
ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS use_flag SMALLINT NOT NULL DEFAULT 1
  CHECK (use_flag IN (0, 1));
CREATE INDEX IF NOT EXISTS idx_inquiries_use_flag ON inquiries(use_flag);

-- subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS use_flag SMALLINT NOT NULL DEFAULT 1
  CHECK (use_flag IN (0, 1));
CREATE INDEX IF NOT EXISTS idx_subscriptions_use_flag ON subscriptions(use_flag);

-- billing_history
ALTER TABLE billing_history
  ADD COLUMN IF NOT EXISTS use_flag SMALLINT NOT NULL DEFAULT 1
  CHECK (use_flag IN (0, 1));
CREATE INDEX IF NOT EXISTS idx_billing_use_flag ON billing_history(use_flag);

-- one_time_payments
ALTER TABLE one_time_payments
  ADD COLUMN IF NOT EXISTS use_flag SMALLINT NOT NULL DEFAULT 1
  CHECK (use_flag IN (0, 1));
CREATE INDEX IF NOT EXISTS idx_one_time_use_flag ON one_time_payments(use_flag);

-- customer_payment_methods
ALTER TABLE customer_payment_methods
  ADD COLUMN IF NOT EXISTS use_flag SMALLINT NOT NULL DEFAULT 1
  CHECK (use_flag IN (0, 1));
CREATE INDEX IF NOT EXISTS idx_pay_methods_use_flag ON customer_payment_methods(use_flag);

-- support_tickets
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS use_flag SMALLINT NOT NULL DEFAULT 1
  CHECK (use_flag IN (0, 1));
CREATE INDEX IF NOT EXISTS idx_tickets_use_flag ON support_tickets(use_flag);

-- posts
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS use_flag SMALLINT NOT NULL DEFAULT 1
  CHECK (use_flag IN (0, 1));
CREATE INDEX IF NOT EXISTS idx_posts_use_flag ON posts(use_flag);

-- 기존 행은 DEFAULT 1 적용됨 (추가 시 NOT NULL DEFAULT 1)
-- 조회 규칙: WHERE use_flag = 1
-- soft delete: UPDATE … SET use_flag = 0


-- ================================================
-- 확인용 (ALTER 실행 후 아래만 선택해서 Run 해도 됨)
-- use_flag 컬럼이 보이고 값이 1 이면 OK
-- ================================================

SELECT * FROM customers;
SELECT * FROM staff;
SELECT * FROM templates;
SELECT * FROM sites;
SELECT * FROM inquiries;
SELECT * FROM subscriptions;
SELECT * FROM billing_history;
SELECT * FROM one_time_payments;
SELECT * FROM customer_payment_methods;
SELECT * FROM support_tickets;
SELECT * FROM posts;

-- 컬럼 존재만 빠르게 확인하려면:
-- SELECT table_name, column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE column_name = 'use_flag'
--   AND table_schema = 'public'
-- ORDER BY table_name;


-- ================================================
-- soft delete 확인 — 「이원장 내과의원」
-- 기대: sites.use_flag = 0 (행은 남아 있음)
-- 목록 조회(use_flag=1)에는 안 나와야 함
-- 아래만 선택해서 Run
-- ================================================

-- 1) 사이트 행 (삭제 후에도 있어야 함, use_flag=0)
SELECT site_id, site_code, name, subdomain, status, deploy_status, use_flag, updated_at
FROM sites
WHERE name ILIKE '%이원장%'
   OR subdomain ILIKE '%이원장%';

-- 2) use_flag=0 인 사이트만
SELECT site_id, name, subdomain, use_flag, status
FROM sites
WHERE use_flag = 0
ORDER BY updated_at DESC;

-- 3) 앱 목록과 동일 — use_flag=1 만 (여기엔 「이원장」이 없어야 정상)
SELECT site_id, name, subdomain, use_flag, status
FROM sites
WHERE use_flag = 1
  AND name ILIKE '%이원장%';

-- 4) 연결 고객·구독은 그대로인지 (사이트 site_id 기준 — 위에서 확인한 site_id로 바꿔도 됨)
SELECT s.name AS site_name, s.use_flag AS site_use_flag,
       c.name AS customer_name, c.email, c.use_flag AS customer_use_flag
FROM sites s
LEFT JOIN customers c ON c.customer_id = s.customer_id
WHERE s.name ILIKE '%이원장%';

SELECT sub.subscription_id, sub.status, sub.use_flag, sub.site_id
FROM subscriptions sub
JOIN sites s ON s.site_id = sub.site_id
WHERE s.name ILIKE '%이원장%';

