-- ================================================
-- supabase_schema_v3.sql
-- 기존 v1(sites, posts) 이후 실행
-- 비즈니스 모델: 고객 → 플랫폼 구독 → 판매자 40% 정산
-- 결제: MVP 수동(계좌이체) → 추후 카드 자동 전환
-- v3 변경: customer_payment_methods 테이블 추가
-- ================================================


-- ================================================
-- 0. 기존 sites 테이블 보완
-- ================================================

ALTER TABLE sites ADD COLUMN IF NOT EXISTS seller_id UUID;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'suspended', 'cancelled'));


-- ================================================
-- 1. sellers (판매자)
-- ================================================

CREATE TABLE sellers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                   VARCHAR(200) UNIQUE NOT NULL,
  name                    VARCHAR(100) NOT NULL,
  phone                   VARCHAR(50),
  bank_name               VARCHAR(50),           -- 정산 은행명
  bank_account            VARCHAR(100),          -- 정산 계좌번호
  bank_holder             VARCHAR(100),          -- 예금주
  status                  VARCHAR(20) NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'suspended', 'withdrawn')),
  current_customer_count  INTEGER NOT NULL DEFAULT 0,
  tier                    VARCHAR(20) NOT NULL DEFAULT 'starter'
                          CHECK (tier IN ('starter', 'pro', 'agency')),
  note                    TEXT,
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sellers_email ON sellers(email);
CREATE INDEX idx_sellers_tier  ON sellers(tier);


-- ================================================
-- 2. customer_plans (플랫폼 정의 구독 플랜)
-- ================================================

CREATE TABLE customer_plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(50) NOT NULL,             -- 'Basic' | 'Standard' | 'Premium'
  code         VARCHAR(20) UNIQUE NOT NULL,      -- 'basic' | 'standard' | 'premium'
  amount       INTEGER NOT NULL,                 -- 월 구독료 (원)
  description  TEXT,
  features     JSONB,                            -- 기능 목록 확장용
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMP DEFAULT NOW()
);

INSERT INTO customer_plans (name, code, amount, description) VALUES
  ('Basic',    'basic',    30000,  '홈페이지 1페이지, 게시판 1개, 문의폼'),
  ('Standard', 'standard', 50000,  '페이지 3개, 게시판 + 예약폼, 커스텀 도메인'),
  ('Premium',  'premium',  100000, '페이지 무제한, 전체 기능, 우선 지원');


-- ================================================
-- 3. customer_payment_methods (고객 카드 정보)
-- ================================================
-- MVP: 테이블만 생성, 실제 사용은 카드 결제 전환 시
-- 카드번호 절대 저장 금지. PG사 발급 빌링키(pg_customer_id)만 저장.

CREATE TABLE customer_payment_methods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         VARCHAR(50) NOT NULL REFERENCES sites(site_id) ON DELETE RESTRICT,
  pg_provider     VARCHAR(50),                   -- 'toss' | 'iamport' | 'kakao' 등
  pg_customer_id  VARCHAR(200) NOT NULL,         -- PG사 발급 빌링키 (카드번호 대체)
  card_last4      VARCHAR(4),                    -- 카드 끝 4자리 (표시용만)
  card_brand      VARCHAR(50),                   -- 'visa' | 'master' | 'kakao' | 'samsung' 등
  card_name       VARCHAR(100),                  -- 카드명 (예: '신한카드')
  is_default      BOOLEAN NOT NULL DEFAULT true, -- 기본 결제 카드 여부
  is_active       BOOLEAN NOT NULL DEFAULT true, -- 유효 카드 여부 (만료/삭제 시 false)
  registered_at   TIMESTAMP DEFAULT NOW(),       -- 카드 등록 시각
  expires_at      TIMESTAMP,                     -- 카드 만료 시각 (갱신 알림용)
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payment_methods_site_id ON customer_payment_methods(site_id);
CREATE INDEX idx_payment_methods_active  ON customer_payment_methods(is_active);


-- ================================================
-- 4. client_billings (고객 구독 계약)
-- ================================================

CREATE TABLE client_billings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           VARCHAR(50) NOT NULL REFERENCES sites(site_id) ON DELETE RESTRICT,
  seller_id         UUID NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
  plan_id           UUID NOT NULL REFERENCES customer_plans(id),
  amount            INTEGER NOT NULL,            -- 청구금액 (플랜 금액 복사본)
  platform_pct      INTEGER NOT NULL DEFAULT 60
                    CHECK (platform_pct BETWEEN 0 AND 100),
  seller_pct        INTEGER NOT NULL DEFAULT 40
                    CHECK (seller_pct BETWEEN 0 AND 100),
  billing_day       INTEGER NOT NULL DEFAULT 1
                    CHECK (billing_day BETWEEN 1 AND 28),
  payment_method    VARCHAR(20) NOT NULL DEFAULT 'manual'
                    CHECK (payment_method IN ('manual', 'card')),
                    -- MVP:  'manual' → 계좌이체 후 관리자 수동 확인
                    -- 추후: 'card'   → PG사 자동 청구
  status            VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'cancelled')),
  started_at        TIMESTAMP DEFAULT NOW(),
  next_billing_date DATE,
  cancelled_at      TIMESTAMP,
  memo              TEXT,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),

  CONSTRAINT pct_sum_check CHECK (platform_pct + seller_pct = 100),
  UNIQUE (site_id)
);

CREATE INDEX idx_client_billings_seller_id      ON client_billings(seller_id);
CREATE INDEX idx_client_billings_status         ON client_billings(status);
CREATE INDEX idx_client_billings_next_billing   ON client_billings(next_billing_date);
CREATE INDEX idx_client_billings_payment_method ON client_billings(payment_method);


-- ================================================
-- 5. billing_history (월별 청구 내역)
-- ================================================
-- MVP:  관리자가 paid_at / status 수동 업데이트
-- 추후: PG사 webhook → 자동 업데이트

CREATE TABLE billing_history (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id         UUID NOT NULL REFERENCES client_billings(id) ON DELETE RESTRICT,
  period             VARCHAR(7) NOT NULL,        -- 청구 월 (예: '2026-03')
  amount             INTEGER NOT NULL,           -- 청구 총액
  platform_amount    INTEGER NOT NULL,           -- 플랫폼 몫 (트리거 자동 계산)
  seller_amount      INTEGER NOT NULL,           -- 판매자 몫 (트리거 자동 계산)
  status             VARCHAR(20) NOT NULL DEFAULT 'unpaid'
                     CHECK (status IN ('unpaid', 'paid', 'overdue')),
  payment_method     VARCHAR(20) NOT NULL DEFAULT 'manual'
                     CHECK (payment_method IN ('manual', 'card')),
  paid_at            TIMESTAMP,                  -- MVP: 관리자 수동 / 추후: webhook 자동
  pg_transaction_id  VARCHAR(200),              -- 추후 PG사 거래번호
  note               TEXT,
  created_at         TIMESTAMP DEFAULT NOW(),

  UNIQUE (billing_id, period)
);

CREATE INDEX idx_billing_history_billing_id ON billing_history(billing_id);
CREATE INDEX idx_billing_history_period     ON billing_history(period);
CREATE INDEX idx_billing_history_status     ON billing_history(status);


-- ================================================
-- 6. settlements (판매자 월별 정산)
-- ================================================
-- MVP:  관리자 계좌이체 후 status = 'paid' 수동 업데이트
-- 추후: 자동 정산 배치

CREATE TABLE settlements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
  period          VARCHAR(7) NOT NULL,
  total_billing   INTEGER NOT NULL DEFAULT 0,    -- 해당 월 고객 구독료 합계
  seller_amount   INTEGER NOT NULL DEFAULT 0,    -- 40% 분배 합계
  extra_fee       INTEGER NOT NULL DEFAULT 0,    -- 티어 수수료 차감
  final_payout    INTEGER NOT NULL DEFAULT 0,    -- 실제 이체액
  customer_count  INTEGER NOT NULL DEFAULT 0,    -- 정산 시점 고객 수
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'paid')),
                  -- pending   → 내역 생성, 확인 전
                  -- confirmed → 판매자 확인 완료
                  -- paid      → 관리자 이체 완료
  settled_at      TIMESTAMP,
  note            TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),

  UNIQUE (seller_id, period)
);

CREATE INDEX idx_settlements_seller_id ON settlements(seller_id);
CREATE INDEX idx_settlements_period    ON settlements(period);
CREATE INDEX idx_settlements_status    ON settlements(status);


-- ================================================
-- 7. support_tickets (고객 수정 요청 티켓)
-- ================================================

CREATE TABLE support_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         VARCHAR(50) NOT NULL REFERENCES sites(site_id) ON DELETE RESTRICT,
  seller_id       UUID NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
  title           VARCHAR(300) NOT NULL,
  content         TEXT NOT NULL,
  category        VARCHAR(50)
                  CHECK (category IN ('text_change', 'image', 'page_add', 'feature', 'etc')),
  status          VARCHAR(20) NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'in_progress', 'resolved', 'escalated')),
                  -- open        → 접수
                  -- in_progress → 처리 중
                  -- resolved    → 완료
                  -- escalated   → 미응답 본사 이관
  priority        VARCHAR(20) NOT NULL DEFAULT 'normal'
                  CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  deadline_days   INTEGER NOT NULL DEFAULT 3,
  deadline_at     TIMESTAMP NOT NULL,            -- 트리거 자동 계산
  escalated_at    TIMESTAMP,
  resolved_at     TIMESTAMP,
  resolver_id     UUID REFERENCES sellers(id),   -- 처리 판매자 (이관 시 본사 id)
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tickets_site_id   ON support_tickets(site_id);
CREATE INDEX idx_tickets_seller_id ON support_tickets(seller_id);
CREATE INDEX idx_tickets_status    ON support_tickets(status);
CREATE INDEX idx_tickets_deadline  ON support_tickets(deadline_at);


-- ================================================
-- 8. tier_history (판매자 티어 변동 기록)
-- ================================================

CREATE TABLE tier_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
  prev_tier       VARCHAR(20) NOT NULL,
  new_tier        VARCHAR(20) NOT NULL,
  customer_count  INTEGER NOT NULL,
  reason          VARCHAR(200),
  extra_fee_pct   INTEGER DEFAULT 0,
  changed_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tier_history_seller_id ON tier_history(seller_id);


-- ================================================
-- 9. RLS
-- ================================================

ALTER TABLE sellers                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_plans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payment_methods   ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_billings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history            ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements                ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_history               ENABLE ROW LEVEL SECURITY;

-- 개발 중 전체 허용 (인증 붙이면 seller_id 기반으로 교체)
CREATE POLICY "sellers_all"         ON sellers                  FOR ALL USING (true);
CREATE POLICY "plans_select"        ON customer_plans           FOR SELECT USING (true);
CREATE POLICY "payment_methods_all" ON customer_payment_methods FOR ALL USING (true);
CREATE POLICY "billings_all"        ON client_billings          FOR ALL USING (true);
CREATE POLICY "billing_hist_all"    ON billing_history          FOR ALL USING (true);
CREATE POLICY "settlements_all"     ON settlements              FOR ALL USING (true);
CREATE POLICY "tickets_all"         ON support_tickets          FOR ALL USING (true);
CREATE POLICY "tier_hist_all"       ON tier_history             FOR ALL USING (true);


-- ================================================
-- 10. 트리거
-- ================================================

-- 10-1. billing_history 생성 시 금액 자동 계산
CREATE OR REPLACE FUNCTION calc_billing_amounts()
RETURNS TRIGGER AS $$
DECLARE
  v_platform_pct INTEGER;
BEGIN
  SELECT platform_pct INTO v_platform_pct
  FROM client_billings WHERE id = NEW.billing_id;

  NEW.platform_amount := ROUND(NEW.amount * v_platform_pct / 100.0);
  NEW.seller_amount   := NEW.amount - NEW.platform_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_billing_amounts
BEFORE INSERT ON billing_history
FOR EACH ROW EXECUTE FUNCTION calc_billing_amounts();


-- 10-2. client_billings 변경 시 sellers.current_customer_count 자동 갱신
CREATE OR REPLACE FUNCTION update_customer_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sellers
  SET
    current_customer_count = (
      SELECT COUNT(*) FROM client_billings
      WHERE seller_id = NEW.seller_id AND status = 'active'
    ),
    updated_at = NOW()
  WHERE id = NEW.seller_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_customer_count
AFTER INSERT OR UPDATE OF status ON client_billings
FOR EACH ROW EXECUTE FUNCTION update_customer_count();


-- 10-3. support_tickets 생성 시 deadline_at 자동 계산
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


-- ================================================
-- 11. 테스트 데이터
-- ================================================

-- 본사 직영 판매자 (고객 이관용)
INSERT INTO sellers (id, email, name, status, tier)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'admin@myplatform.com',
  '본사 직영',
  'active',
  'agency'
);

-- 테스트 판매자
INSERT INTO sellers (id, email, name, phone, status, tier)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'seller@myplatform.com',
  '홍길동 에이전시',
  '010-1234-5678',
  'active',
  'starter'
);

-- 기존 testsite01에 seller_id 연결
UPDATE sites
SET seller_id = '00000000-0000-0000-0000-000000000001'
WHERE site_id = 'testsite01';

-- 테스트 유지관리 계약 (Standard 플랜, 수동 결제)
INSERT INTO client_billings (
  site_id, seller_id, plan_id, amount,
  platform_pct, seller_pct,
  billing_day, payment_method, status, next_billing_date
)
SELECT
  'testsite01',
  '00000000-0000-0000-0000-000000000001',
  id,
  amount,
  60, 40,
  1, 'manual', 'active', '2026-04-01'
FROM customer_plans WHERE code = 'standard';

-- ================================================
-- 완료
-- 실행 순서: supabase_schema.sql → supabase_schema_v3.sql
--
-- 카드 결제 전환 체크리스트 (추후):
--   1. PG사 연동 (토스페이먼츠 권장)
--   2. 고객 카드 등록 → customer_payment_methods.pg_customer_id 저장
--   3. client_billings.payment_method = 'card' 업데이트
--   4. 매월 billing_day → PG사에 빌링키로 자동 청구
--   5. webhook 수신 → billing_history 자동 기록
--   6. 실패 시 → status = 'overdue' + 알림 발송
-- ================================================
