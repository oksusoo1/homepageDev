-- ================================================
-- schema_v2.1_2026-08-31.sql
-- PK 명명규칙: 테이블명_id
-- v2.1 변경: staff 테이블 추가 (본사 직원 / platform 관리자)
-- sites.site_id (UUID PK) / sites.site_code (VARCHAR 식별자)
-- ================================================


-- ================================================
-- 기존 테이블 초기화 (처음부터 다시)
-- ================================================
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS billing_history CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS one_time_payments CASCADE;
DROP TABLE IF EXISTS customer_payment_methods CASCADE;
DROP TABLE IF EXISTS inquiries CASCADE;
DROP TABLE IF EXISTS sites CASCADE;
DROP TABLE IF EXISTS templates CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

DROP FUNCTION IF EXISTS set_ticket_deadline() CASCADE;
DROP FUNCTION IF EXISTS sync_site_status() CASCADE;


-- ================================================
-- 1. customers
-- ================================================

CREATE TABLE customers (
  customer_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id       UUID UNIQUE,                       -- FK → auth.users(id)
  email         VARCHAR(200) UNIQUE NOT NULL,
  name          VARCHAR(100) NOT NULL,
  phone         VARCHAR(50),
  -- status: active(정상) | suspended(정지) | withdrawn(탈퇴)
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'suspended', 'withdrawn')),
  withdraw_at   TIMESTAMP,                         -- 탈퇴 예약일 (미래: 만료 대기, 과거: 자동 withdrawn 처리)
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_customers_email ON customers(email);


-- ================================================
-- 2. staff (본사 직원 — platform 관리자)
-- ================================================

CREATE TABLE staff (
  staff_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id     UUID UNIQUE NOT NULL,                  -- FK → auth.users(id)
  email       VARCHAR(200) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  -- role: platform_admin(플랫폼관리) | support(지원) | viewer(읽기전용)
  role        VARCHAR(30) NOT NULL DEFAULT 'platform_admin'
              CHECK (role IN ('platform_admin', 'support', 'viewer')),
  -- status: active(재직) | suspended(정지) | left(퇴사)
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'suspended', 'left')),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_staff_auth_id ON staff(auth_id);
CREATE INDEX idx_staff_email    ON staff(email);
CREATE INDEX idx_staff_status   ON staff(status);


-- ================================================
-- 3. templates
-- ================================================

CREATE TABLE templates (
  template_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(100) NOT NULL,
  category         VARCHAR(50) NOT NULL,
  thumbnail_url    VARCHAR(500),
  default_content  JSONB,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  sort_order       INTEGER DEFAULT 0,
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_templates_category ON templates(category);
CREATE INDEX idx_templates_active   ON templates(is_active);

INSERT INTO templates (name, category, sort_order) VALUES
  ('카페 기본형',     'cafe',       1),
  ('식당 심플',       'restaurant', 2),
  ('미용실 모던',     'salon',      3),
  ('병원/의원 클린',  'clinic',     4),
  ('학원 밝은',       'academy',    5),
  ('일반 소개 기본',  'general',    6);


-- ================================================
-- 4. sites
-- ================================================

CREATE TABLE sites (
  site_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_code       VARCHAR(50) UNIQUE NOT NULL,   -- URL 식별자 (예: 'hongcafe_001')
  customer_id     UUID NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
  template_id     UUID REFERENCES templates(template_id),
  name            VARCHAR(200) NOT NULL,
  subdomain       VARCHAR(100) UNIQUE NOT NULL,  -- 서브도메인 (예: 'hong')
  domain          VARCHAR(200) UNIQUE,           -- 커스텀 도메인
  description     TEXT,
  address         VARCHAR(300),
  phone           VARCHAR(50),
  email           VARCHAR(200),
  -- build_type: self(고객직접제작) | managed(본사대리제작)
  build_type      VARCHAR(20) NOT NULL DEFAULT 'self'
                  CHECK (build_type IN ('self', 'managed')),
  content         JSONB,
  -- status: draft(미배포) | published(운영중) | suspended(정지) | cancelled(해지됨)
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'suspended', 'cancelled')),
  -- deploy_status: pending(대기) | building(빌드중) | live(배포완료) | failed(실패)
  deploy_status   VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (deploy_status IN ('pending', 'building', 'live', 'failed')),
  inquiry_id       UUID,                                    -- 루트 B: 연결된 제작 문의 (FK는 inquiries 생성 후 추가)
  trial_started_at TIMESTAMP,
  trial_ends_at    TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sites_customer_id ON sites(customer_id);
CREATE INDEX idx_sites_site_code   ON sites(site_code);
CREATE INDEX idx_sites_subdomain   ON sites(subdomain);
CREATE INDEX idx_sites_status      ON sites(status);


-- ================================================
-- 5. one_time_payments
-- ================================================

CREATE TABLE one_time_payments (
  payment_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
  site_id       UUID REFERENCES sites(site_id) ON DELETE RESTRICT,
  -- type: domain_setup(도메인대행) | dev_fee(개발비) | extra(기타)
  type          VARCHAR(50) NOT NULL
                CHECK (type IN ('domain_setup', 'dev_fee', 'extra')),
  amount        INTEGER NOT NULL,
  -- status: unpaid(미납) | paid(납부완료)
  status        VARCHAR(20) NOT NULL DEFAULT 'unpaid'
                CHECK (status IN ('unpaid', 'paid')),
  note          TEXT,
  paid_at       TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_one_time_customer_id ON one_time_payments(customer_id);
CREATE INDEX idx_one_time_site_id     ON one_time_payments(site_id);
CREATE INDEX idx_one_time_status      ON one_time_payments(status);


-- ================================================
-- 6. customer_payment_methods
-- ================================================

CREATE TABLE customer_payment_methods (
  payment_method_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
  pg_provider         VARCHAR(50),
  pg_customer_id      VARCHAR(200) NOT NULL,  -- PG사 빌링키
  card_last4          VARCHAR(4),
  card_brand          VARCHAR(50),
  card_name           VARCHAR(100),
  is_default          BOOLEAN NOT NULL DEFAULT true,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  registered_at       TIMESTAMP DEFAULT NOW(),
  created_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pay_methods_customer_id ON customer_payment_methods(customer_id);
CREATE INDEX idx_pay_methods_active      ON customer_payment_methods(is_active);


-- ================================================
-- 7. subscriptions
-- ================================================

CREATE TABLE subscriptions (
  subscription_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
  site_id           UUID NOT NULL REFERENCES sites(site_id) ON DELETE RESTRICT,
  amount            INTEGER NOT NULL DEFAULT 30000,
  billing_day       INTEGER NOT NULL DEFAULT 1
                    CHECK (billing_day BETWEEN 1 AND 28),
  -- payment_method: manual(계좌이체/수동확인) | card(자동카드결제)
  payment_method    VARCHAR(20) NOT NULL DEFAULT 'manual'
                    CHECK (payment_method IN ('manual', 'card')),
  -- status: pending(결제대기) | trial(무료체험중) | active(구독중) | paused(일시정지) | cancelled(해지됨)
  -- 해지예약 판단: status='active' AND cancelled_at IS NOT NULL AND cancels_at > now()
  status            VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('pending', 'trial', 'active', 'paused', 'cancelled')),
  started_at        TIMESTAMP DEFAULT NOW(),
  next_billing_date DATE,
  cancelled_at      TIMESTAMP,                     -- 해지 요청일
  cancels_at        TIMESTAMP,                     -- 서비스 종료 예정일 (이 날짜 이후 자동 cancelled 처리)
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),

  UNIQUE (site_id)  -- 사이트당 구독 1개
);

CREATE INDEX idx_subscriptions_customer_id  ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_site_id      ON subscriptions(site_id);
CREATE INDEX idx_subscriptions_status       ON subscriptions(status);


-- ================================================
-- 8. billing_history
-- ================================================

CREATE TABLE billing_history (
  billing_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id     UUID NOT NULL REFERENCES subscriptions(subscription_id) ON DELETE RESTRICT,
  period              VARCHAR(7) NOT NULL,      -- '2026-03'
  amount              INTEGER NOT NULL,
  -- status: unpaid(미납) | paid(납부완료) | overdue(연체)
  status              VARCHAR(20) NOT NULL DEFAULT 'unpaid'
                      CHECK (status IN ('unpaid', 'paid', 'overdue')),
  -- payment_method: manual(계좌이체) | card(자동카드결제)
  payment_method      VARCHAR(20) NOT NULL DEFAULT 'manual'
                      CHECK (payment_method IN ('manual', 'card')),
  paid_at             TIMESTAMP,
  pg_transaction_id   VARCHAR(200),
  note                TEXT,
  created_at          TIMESTAMP DEFAULT NOW(),

  UNIQUE (subscription_id, period)
);

CREATE INDEX idx_billing_subscription_id ON billing_history(subscription_id);
CREATE INDEX idx_billing_period          ON billing_history(period);
CREATE INDEX idx_billing_status          ON billing_history(status);


-- ================================================
-- 9. support_tickets
-- ================================================

CREATE TABLE support_tickets (
  ticket_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(site_id) ON DELETE RESTRICT,
  customer_id     UUID NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
  title           VARCHAR(300) NOT NULL,
  content         TEXT NOT NULL,
  -- category: text_change(텍스트수정) | image(이미지교체) | page_add(페이지추가) | feature(기능추가) | etc(기타)
  category        VARCHAR(50)
                  CHECK (category IN ('text_change', 'image', 'page_add', 'feature', 'etc')),
  -- status: open(접수) | in_progress(처리중) | resolved(완료)
  status          VARCHAR(20) NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'in_progress', 'resolved')),
  -- priority: low(낮음) | normal(보통) | high(높음) | urgent(긴급)
  priority        VARCHAR(20) NOT NULL DEFAULT 'normal'
                  CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  deadline_days   INTEGER NOT NULL DEFAULT 3,
  deadline_at     TIMESTAMP NOT NULL,
  resolved_at     TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tickets_site_id     ON support_tickets(site_id);
CREATE INDEX idx_tickets_customer_id ON support_tickets(customer_id);
CREATE INDEX idx_tickets_status      ON support_tickets(status);
CREATE INDEX idx_tickets_deadline    ON support_tickets(deadline_at);


-- ================================================
-- 10. inquiries (본사 제작 문의 — 루트 B)
-- ================================================

CREATE TABLE inquiries (
  inquiry_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
  -- business_type: cafe | restaurant | salon | clinic | academy | general | etc
  business_type   VARCHAR(50),
  description     TEXT,                        -- 원하는 사이트 설명
  phone           VARCHAR(50),                 -- 연락받을 연락처
  -- status: received(접수) | reviewing(검토/견적) | building(제작중) | review(고객검수대기) | approved(잔금완료) | done(배포완료)
  status          VARCHAR(20) NOT NULL DEFAULT 'received'
                  CHECK (status IN ('received', 'reviewing', 'building', 'review', 'approved', 'done')),
  dev_fee_total   INTEGER,                     -- 총 개발비 (견적 확정 시 입력)
  down_paid_at    TIMESTAMP,                   -- 선금 50% 납부 확인일
  final_paid_at   TIMESTAMP,                   -- 잔금 50% 납부 확인일
  admin_note      TEXT,                        -- 관리자 메모
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_inquiries_customer_id ON inquiries(customer_id);
CREATE INDEX idx_inquiries_status      ON inquiries(status);

CREATE POLICY "inquiries_all" ON inquiries FOR ALL USING (true);
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- sites.inquiry_id FK (inquiries 생성 후 추가)
ALTER TABLE sites ADD CONSTRAINT fk_sites_inquiry
  FOREIGN KEY (inquiry_id) REFERENCES inquiries(inquiry_id);

CREATE INDEX idx_sites_inquiry_id ON sites(inquiry_id);


-- ================================================
-- 11. posts
-- ================================================

CREATE TABLE posts (
  post_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID NOT NULL REFERENCES sites(site_id) ON DELETE RESTRICT,
  title       VARCHAR(500) NOT NULL,
  content     TEXT NOT NULL,
  author      VARCHAR(100) NOT NULL DEFAULT '관리자',
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_posts_site_id ON posts(site_id);


-- ================================================
-- 12. RLS
-- ================================================

ALTER TABLE customers                ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates                ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE one_time_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history          ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts                    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_all"      ON customers                FOR ALL USING (true);
CREATE POLICY "staff_all"          ON staff                    FOR ALL USING (true);
CREATE POLICY "templates_select"   ON templates                FOR SELECT USING (true);
CREATE POLICY "sites_all"          ON sites                    FOR ALL USING (true);
CREATE POLICY "one_time_all"       ON one_time_payments        FOR ALL USING (true);
CREATE POLICY "pay_methods_all"    ON customer_payment_methods FOR ALL USING (true);
CREATE POLICY "subscriptions_all"  ON subscriptions            FOR ALL USING (true);
CREATE POLICY "billing_hist_all"   ON billing_history          FOR ALL USING (true);
CREATE POLICY "tickets_all"        ON support_tickets          FOR ALL USING (true);
CREATE POLICY "posts_all"          ON posts                    FOR ALL USING (true);


-- ================================================
-- 13. 트리거
-- ================================================

-- 티켓 생성 시 deadline_at 자동 계산
CREATE OR REPLACE FUNCTION set_ticket_deadline()
RETURNS TRIGGER AS $$
BEGIN
  NEW.deadline_at := NOW() + (NEW.deadline_days || ' days')::INTERVAL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_ticket_deadline
BEFORE INSERT ON support_tickets
FOR EACH ROW EXECUTE FUNCTION set_ticket_deadline();

-- 구독 취소/정지 시 사이트 status 자동 동기화
-- cancels_at 있는 해지예약은 즉시 사이트 변경 안 함 (잔여기간 보장)
-- 실제 만료는 preview/[domain]/page.js 방문 시 또는 관리자 "만료 구독 처리" 버튼으로 처리
CREATE OR REPLACE FUNCTION sync_site_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND NEW.cancels_at IS NULL THEN
    -- 즉시 취소: 사이트도 바로 cancelled
    UPDATE sites SET status = 'cancelled', updated_at = NOW()
    WHERE site_id = NEW.site_id;
  ELSIF NEW.status = 'paused' THEN
    UPDATE sites SET status = 'suspended', updated_at = NOW()
    WHERE site_id = NEW.site_id;
  ELSIF NEW.status IN ('active', 'trial') THEN
    -- 재구독/재활성화 시 suspended·cancelled 사이트를 published로 복원
    UPDATE sites SET status = 'published', updated_at = NOW()
    WHERE site_id = NEW.site_id AND status IN ('suspended', 'cancelled');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_site_status
AFTER UPDATE OF status ON subscriptions
FOR EACH ROW EXECUTE FUNCTION sync_site_status();


-- ================================================
-- 완료 (schema v2.1)
-- ================================================
