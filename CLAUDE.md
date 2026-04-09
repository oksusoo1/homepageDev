## 프로젝트 개요
노코드 웹빌더 플랫폼 개발. 쇼핑몰이 필요없는 소상공인(식당/카페/미용실/학원/병원 등) 타겟.
고객(소상공인)이 직접 또는 본사 대리로 사이트를 만들고, 월 3만원 구독료를 납부하는 구조.

## 비즈니스 모델
- 수익 1: 고객 월 구독료 3만원 (반복 수익 핵심)
- 수익 2: 본사 대리 개발비 (1회성)
- 수익 3: 도메인 대행 수수료 5만원 (1회성)
- 판매자(에이전시) 구조는 2차 개발 예정

## 고객 플로우
- 루트 A: 고객 직접 → 가입 → 템플릿 선택 → 에디터 편집 → 배포 → 카드등록
- 루트 B: 본사 대리 → 가입 → 본사에 개발의뢰(개발비) → 본사가 제작/배포 → 카드등록
- 공통: 배포 후 월 3만원 자동이체, 도메인 연결은 직원 대행(5만원 선택)

## 기술 스택
- Frontend/Backend: Next.js 15 (App Router)
- Database: Supabase (PostgreSQL + JSONB)
- 배포: Vercel
- 인증: Supabase Auth (임시: wonse@hos.com / test123)
- 에디터: GrapesJS (추후 적용)

## 프로젝트 구조
- /app/platform → 회사 관리자 콘솔 (본사 직원용)
- /app/my → 고객 로그인 후 내 사이트 목록
- /app/my/[subdomain] → 고객 전용 포털 (기본정보수정/수정요청/요청현황/에디터)
- /app/login → 고객 로그인 페이지
- /app/preview/[domain] → 고객 사이트 (방문자용, 멀티테넌트)
- /app/preview/[domain]/board → 게시판
- /app/preview/[domain]/board/[post_id] → 게시글 상세
- /app/preview/[domain]/board/write → 글쓰기
- /lib/supabase.js → Supabase 클라이언트
- middleware.js → 도메인 기반 라우팅

## DB 스키마 (v2 - PK 명명규칙: 테이블명_id)
> 전체 스키마 SQL 참고: @my-platform/supabase_schema_mvp_v2.sql
> 테스트 데이타 참고 : @my-platform/sample_data_v2.sql


- customers: customer_id(PK), auth_id(FK→auth.users), email, name, phone
- templates: template_id(PK), name, category, default_content(JSONB)
- sites: site_id(UUID PK), site_code(VARCHAR URL식별자), customer_id(FK), template_id(FK), subdomain, domain, build_type(self/managed), status, deploy_status
- subscriptions: subscription_id(PK), customer_id(FK), site_id(FK), amount(30000), payment_method(manual/card), status
- billing_history: billing_id(PK), subscription_id(FK), period, amount, status(unpaid/paid/overdue), pg_transaction_id
- one_time_payments: payment_id(PK), customer_id(FK), site_id(FK), type(domain_setup/dev_fee/extra), amount, status
- customer_payment_methods: payment_method_id(PK), customer_id(FK), pg_customer_id(빌링키), card_last4
- support_tickets: ticket_id(PK), site_id(FK), customer_id(FK), title, category, status(open/in_progress/resolved), deadline_at
- posts: post_id(UUID PK), site_id(UUID FK→sites.site_id), title, content, author

## DB 핵심 규칙
- PK는 반드시 테이블명_id 형식 (예: customer_id, site_id, post_id)
- sites.site_id = UUID PK (FK 연결용)
- sites.site_code = VARCHAR (URL 식별자, 예: 'hongcafe_001')
- 혼용 금지: site_id는 UUID, site_code는 문자열

## 개발 규칙
- 새 작업 시작 전 `작업내역/` 폴더의 최신 {날짜}_작업.md 파일을 반드시 읽고 시작할 것
- 코드 수정 시 AS-IS/TO-BE 형식으로 변경 부분만 제시
- Next.js 15 서버 컴포넌트: params는 await 처리
- Next.js 15 클라이언트 컴포넌트: params는 React.use() 사용
- 환경변수는 .env.local 사용 (Git 제외)
- 전체 파일 새로 작성 시 압축파일로 폴더구조 포함하여 제공

## 개발 우선순위
- 1차 목표: 전체 프로세스 플로우 정의 및 동작 확인 (진행중)
- 2차 목표: 각 기능 세부 완성도 개선
- 3차 목표: GrapesJS 에디터 연동, 카드 결제(토스페이먼츠), 판매자 구조 추가

## 현재 진행 상황 (2026-04-07 기준)

### 구현 완료된 페이지
- `app/page.js` — 랜딩 페이지
- `app/login/page.js` — 로그인
- `app/setup/page.js` — 사이트 기본 정보 설정
- `app/templates/page.js` — 템플릿 선택
- `app/editor/[subdomain]/page.js` — 심플 패널 에디터 (히어로/연락처/섹션 on-off, 실시간 미리보기)
- `app/my/page.js` — 내 사이트 목록
- `app/my/[subdomain]/page.js` — 고객 포털 (내 사이트/수정요청/요청현황/결제 탭)
- `app/preview/[domain]/page.js` — 방문자용 사이트 (suspended 시 안내 페이지 표시)
- `app/preview/[domain]/board` — 게시판 (목록/상세/쓰기)
- `app/payment/card/page.js` — 카드 등록 (현재 MOCK_MODE=true)
- `app/payment/card/success/page.js` — 등록 완료
- `app/payment/card/fail/page.js` — 등록 실패
- `app/api/payment/billing-auth/route.js` — 토스 빌링키 승인 API
- `app/platform/page.js` — 관리자 콘솔 (사이트관리/구독현황/수정요청/1회성결제 탭)

### 무료 체험 플로우 (2026-04-07 추가)
- 배포 시 `trial_started_at`, `trial_ends_at(+14일)` 자동 설정
- 배포 시 subscriptions 자동 생성 (status: trial)
- 결제 탭: 체험 D-day 표시, 체험 안내 배너
- 관리자 콘솔: 사이트별 체험 D-day 뱃지
- suspended 사이트: 방문자에게 🔒 안내 페이지 표시
- DB 컬럼 추가 필요: `sites.trial_started_at`, `sites.trial_ends_at`, `subscriptions.status`에 trial 추가

### 결제 관련 메모
- 토스페이먼츠 MOCK_MODE=true 상태 (실제 팝업 없이 자체 폼으로 대체)
- 실서비스 전환 시: `app/payment/card/page.js` 상단 `MOCK_MODE = false` 로만 변경
- `.env.local`에 `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY` 필요
- 카드 등록: upsert 대신 기존카드 비활성화 후 insert 방식 사용

### 다음 작업 후보 (미구현)
- 체험 만료 후 자동 정지 처리 (스케줄러 또는 관리자 수동)
- 카드 등록 후 subscriptions.status = 'active' 자동 전환
- payment/card/page.js 디버깅 console.log 제거 (실서비스 전)
- GrapesJS 에디터 연동 (현재는 심플 패널 에디터)
- 토스페이먼츠 실결제 연동
- 판매자(에이전시) 구조