-- ================================================
-- supabase_schema_v2.sql
-- 기존 v1 스키마(sites, posts)에 이어서 실행하세요
-- 새 비즈니스 모델 기반: 분배/정산/티켓/티어 구조
-- ================================================


-- ================================================
-- 0. 기존 테이블 보완 (sites에 seller_id 컬럼 추가)
-- ================================================

-- 기존 sites 테이블에 seller_id 연결 컬럼 추가
ALTER TABLE sites ADD COLUMN IF NOT EXISTS seller_id UUID;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'suspended', 'cancelled'));

-- 기존 owner_email → 나중에 sellers.id로 마이그레이션 예정
-- 지금은 owner_email 유지, seller_id는 nullable로 시작


-- ================================================
-- 1. sellers (판매자)
-- ================================================

CREATE TABLE sellers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 VARCHAR(200) UNIQUE NOT NULL,    -- 로그인 이메일 (추후 auth.users 연동)
  name                  VARCHAR(100) NOT NULL,            -- 판매자 이름/상호
  phone                 VARCHAR(50),                      -- 연락처
  bank_name             VARCHAR(50),                      -- 정산 은행명
  bank_account          VARCHAR(100),                     -- 정산 계좌번호
  bank_holder           VARCHAR(100),                     -- 예금주
  status                VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'suspended', 'withdrawn')),
  current_customer_count INTEGER NOT NULL DEFAULT 0,      -- 현재 활성 고객 수 (자동 집계)
  tier                  VARCHAR(20) NOT NULL DEFAULT 'starter'
                        CHECK (tier IN ('starter', 'pro', 'agency')),
  note                  TEXT,                             -- 관리자 메모
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_sellers_email ON sellers(email);
CREATE INDEX idx_sellers_tier ON sellers(tier);


-- ================================================
-- 2. client_billings (고객 유지관리 계약)
-- ================================================

-- 기존 client_billings 테이블이 있다면 DROP 후 재생성
-- 없다면 CREATE

CREATE TABLE client_billings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           VARCHAR(50) NOT NULL REFERENCES sites(site_id) ON DELETE RESTRICT,
  seller_id         UUID NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
  amount            INTEGER NOT NULL,                     -- 월 유지관리비 (원 단위, 예: 50000)
  platform_pct      INTEGER NOT NULL DEFAULT 60           -- 플랫폼 분배율 (%)
                    CHECK (platform_pct BETWEEN 0 AND 100),
  seller_pct        INTEGER NOT NULL DEFAULT 40           -- 판매자 분배율 (%)
                    CHECK (seller_pct BETWEEN 0 AND 100),
  billing_day       INTEGER NOT NULL DEFAULT 1            -- 매월 청구일
                    CHECK (billing_day BETWEEN 1 AND 28),
  status            VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'cancelled')),
  started_at        TIMESTAMP DEFAULT NOW(),
  next_billing_date DATE,
  cancelled_at      TIMESTAMP,
  memo              TEXT,                                 -- 판매자 메모 (고객 비공개)
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),

  -- platform_pct + seller_pct = 100 보장
  CONSTRAINT pct_sum_check CHECK (platform_pct + seller_pct = 100),
  -- 사이트당 활성 계약 1개만
  UNIQUE (site_id)
);

-- 인덱스
CREATE INDEX idx_client_billings_seller_id ON client_billings(seller_id);
CREATE INDEX idx_client_billings_status ON client_billings(status);
CREATE INDEX idx_client_billings_next_billing ON client_billings(next_billing_date);


-- ================================================
-- 3. billing_history (월별 청구 내역)
-- ================================================

CREATE TABLE billing_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id       UUID NOT NULL REFERENCES client_billings(id) ON DELETE RESTRICT,
  period           VARCHAR(7) NOT NULL,                   -- 청구 월 (예: '2026-03')
  amount           INTEGER NOT NULL,                      -- 해당 월 청구 총액 (복사본)
  platform_amount  INTEGER NOT NULL,                      -- 플랫폼 몫 (amount × platform_pct / 100)
  seller_amount    INTEGER NOT NULL,                      -- 판매자 몫 (amount × seller_pct / 100)
  status           VARCHAR(20) NOT NULL DEFAULT 'unpaid'
                   CHECK (status IN ('unpaid', 'paid', 'overdue')),
  paid_at          TIMESTAMP,                             -- 납부 확인 시각
  payment_method   VARCHAR(50),                           -- 'manual' | 'card' | 'bank_transfer'
  note             TEXT,                                  -- 이번 회차 메모
  created_at       TIMESTAMP DEFAULT NOW(),

  UNIQUE (billing_id, period)                             -- 같은 달 중복 청구 방지
);

-- 인덱스
CREATE INDEX idx_billing_history_billing_id ON billing_history(billing_id);
CREATE INDEX idx_billing_history_period ON billing_history(period);
CREATE INDEX idx_billing_history_status ON billing_history(status);


-- ================================================
-- 4. settlements (판매자 월별 정산)
-- ================================================

CREATE TABLE settlements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id        UUID NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
  period           VARCHAR(7) NOT NULL,                   -- 정산 월 (예: '2026-03')
  total_billing    INTEGER NOT NULL DEFAULT 0,            -- 해당 월 고객 유지관리비 합계
  seller_amount    INTEGER NOT NULL DEFAULT 0,            -- 40% 분배 합계
  extra_fee        INTEGER NOT NULL DEFAULT 0,            -- 티어 수수료 차감액 (Pro/Agency)
  final_payout     INTEGER NOT NULL DEFAULT 0,            -- 실제 이체액 (seller_amount - extra_fee)
  customer_count   INTEGER NOT NULL DEFAULT 0,            -- 정산 시점 고객 수
  status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'confirmed', 'paid')),
  settled_at       TIMESTAMP,                             -- 실제 이체 완료 시각
  note             TEXT,                                  -- 관리자 메모
  created_at       TIMESTAMP DEFAULT NOW(),

  UNIQUE (seller_id, period)                              -- 판매자당 월 1회 정산
);

-- 인덱스
CREATE INDEX idx_settlements_seller_id ON settlements(seller_id);
CREATE INDEX idx_settlements_period ON settlements(period);
CREATE INDEX idx_settlements_status ON settlements(status);


-- ================================================
-- 5. support_tickets (수정 요청 티켓)
-- ================================================

CREATE TABLE support_tickets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           VARCHAR(50) NOT NULL REFERENCES sites(site_id) ON DELETE RESTRICT,
  seller_id         UUID NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
  title             VARCHAR(300) NOT NULL,                -- 요청 제목
  content           TEXT NOT NULL,                        -- 요청 내용
  category          VARCHAR(50),                          -- 'text_change' | 'image' | 'page_add' | 'etc'
  status            VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'resolved', 'escalated')),
  -- 'escalated': 미응답으로 본사 이관된 상태
  priority          VARCHAR(20) NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  deadline_days     INTEGER NOT NULL DEFAULT 3,           -- 응답 기한 (영업일)
  deadline_at       TIMESTAMP NOT NULL,                   -- 응답 기한 시각 (자동 계산)
  escalated_at      TIMESTAMP,                            -- 본사 이관 시각
  resolved_at       TIMESTAMP,                            -- 완료 시각
  resolver_id       UUID REFERENCES sellers(id),          -- 처리한 판매자 (이관 시 본사 seller_id)
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_tickets_site_id ON support_tickets(site_id);
CREATE INDEX idx_tickets_seller_id ON support_tickets(seller_id);
CREATE INDEX idx_tickets_status ON support_tickets(status);
CREATE INDEX idx_tickets_deadline ON support_tickets(deadline_at);


-- ================================================
-- 6. tier_history (판매자 티어 변동 기록)
-- ================================================

CREATE TABLE tier_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id        UUID NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
  prev_tier        VARCHAR(20) NOT NULL,                  -- 변경 전 티어
  new_tier         VARCHAR(20) NOT NULL,                  -- 변경 후 티어
  customer_count   INTEGER NOT NULL,                      -- 변경 시점 고객 수
  reason           VARCHAR(200),                          -- 변경 사유 (예: '고객 21명 초과')
  extra_fee_pct    INTEGER DEFAULT 0,                     -- 적용된 추가 수수료율 (%)
  changed_at       TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_tier_history_seller_id ON tier_history(seller_id);


-- ================================================
-- 7. RLS (Row Level Security)
-- ================================================

ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_billings ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_history ENABLE ROW LEVEL SECURITY;

-- 임시: 개발 중에는 전체 허용 (인증 붙이면 seller_id 기반으로 교체)
CREATE POLICY "sellers_all" ON sellers FOR ALL USING (true);
CREATE POLICY "client_billings_all" ON client_billings FOR ALL USING (true);
CREATE POLICY "billing_history_all" ON billing_history FOR ALL USING (true);
CREATE POLICY "settlements_all" ON settlements FOR ALL USING (true);
CREATE POLICY "support_tickets_all" ON support_tickets FOR ALL USING (true);
CREATE POLICY "tier_history_all" ON tier_history FOR ALL USING (true);


-- ================================================
-- 8. 자동화 함수 (트리거)
-- ================================================

-- 8-1. billing_history 생성 시 platform_amount / seller_amount 자동 계산
CREATE OR REPLACE FUNCTION calc_billing_amounts()
RETURNS TRIGGER AS $$
BEGIN
  NEW.platform_amount := ROUND(NEW.amount * (
    SELECT platform_pct FROM client_billings WHERE id = NEW.billing_id
  ) / 100.0);
  NEW.seller_amount := NEW.amount - NEW.platform_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_billing_amounts
BEFORE INSERT ON billing_history
FOR EACH ROW EXECUTE FUNCTION calc_billing_amounts();


-- 8-2. client_billings 상태 변경 시 sellers.current_customer_count 자동 갱신
CREATE OR REPLACE FUNCTION update_customer_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sellers
  SET current_customer_count = (
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


-- 8-3. support_tickets 생성 시 deadline_at 자동 계산 (생성일 + deadline_days)
CREATE OR REPLACE FUNCTION set_ticket_deadline()
RETURNS TRIGGER AS $$
BEGIN
  NEW.deadline_at := NEW.created_at + (NEW.deadline_days || ' days')::INTERVAL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_ticket_deadline
BEFORE INSERT ON support_tickets
FOR EACH ROW EXECUTE FUNCTION set_ticket_deadline();


-- ================================================
-- 9. 테스트 데이터 (개발용)
-- ================================================

-- 테스트 판매자 1명
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

-- 테스트 유지관리 계약
INSERT INTO client_billings (
  site_id, seller_id, amount, platform_pct, seller_pct,
  billing_day, status, next_billing_date
)
VALUES (
  'testsite01',
  '00000000-0000-0000-0000-000000000001',
  50000,    -- 월 5만원
  60,       -- 플랫폼 60%
  40,       -- 판매자 40%
  1,        -- 매월 1일
  'active',
  '2026-04-01'
);

-- ================================================
-- 완료
-- 실행 순서: supabase_schema.sql → supabase_schema_v2.sql
-- ================================================
