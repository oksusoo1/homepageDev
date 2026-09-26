## 프로젝트 개요
노코드 웹빌더 플랫폼 개발. 쇼핑몰이 필요없는 소상공인(식당/카페/미용실/학원/병원 등) 타겟.
고객(소상공인)이 직접 또는 본사 대리로 사이트를 만들고, 월 3만원 구독료를 납부하는 구조.

## 비즈니스 모델
- 수익 1: 고객 월 구독료 3만원 (반복 수익 핵심)
- 수익 2: 본사 대리 개발비 (1회성, 선금 50% / 잔금 50%)
- 수익 3: 도메인 대행 수수료 5만원 (1회성)
- 판매자(에이전시) 구조는 2차 개발 예정

## 고객 플로우
> 상세: @my-platform/docs/플로우.md — 진도 SSOT = `sites.status` (FLOW_STEP)
- 루트 A 셀프: 가입 → 템플릿 선택 → 에디터 편집 → 결제수단 등록 → 14일 체험 → 구독
  - `building → pay_method → trial → subscribed`
- 루트 B 대리: 가입 → 제작의뢰 → 견적·선금 → 본사 제작 → 검토 → 잔금 → 결제수단 등록 → 체험 → 구독
  - `intake → deposit → building → preview → balance → pay_method → trial → subscribed`
- 공통: 체험 후 월 3만원 청구(카드 자동 / 계좌이체), 미납 시 `suspended`. 도메인 연결은 직원 대행(5만원 선택)

## 인증 (v1.3)
- 세션: `@supabase/ssr` 쿠키 (브라우저 `lib/supabase.js` · 서버 `lib/supabase/server.js`)
- 고객: `/login` 회원가입 → `auth.users` + `customers` → `/my`
- 관리자: Supabase UI Create user + `staff` INSERT → `/platform` (`role=platform_admin`)
- 브라우저 표시용: `lib/auth.js` — `requireAuthUser()`, `isPlatformAdmin()`, `getPostLoginPath()`
- 서버 차단: `lib/server/guard.js` — `getServerUser()`, `requireStaff()`, `requireSiteOwner()`
- `/platform` 은 `layout.js`에서 `requireStaff()` + DB는 `app/platform/actions.js` + `lib/supabase/admin.js` (service role)
- 고객 결제·상태 전환: `app/s/[siteCode]/admin/actions.js` · `app/my/actions.js` (`requireOwnedSiteByCode` / `requireOwnedInquiry`)
- 문서: `docs/플로우.md` · `docs/db/테이블명세.md` · `docs/db/ERD.md` · `docs/설계/방문자회원.md`(설계만, 구현 전)

## 기술 스택
- Frontend/Backend: Next.js 16 (App Router) + React 19, Tailwind 4
- Database: Supabase (PostgreSQL + JSONB)
- 실행: 로컬 `start-dev.bat` / pm2 `ecosystem.config.js` (배포: Vercel 예정)
- 인증: Supabase Auth (임시: wonse@hos.com / test123)
- 에디터: 심플 패널 에디터 (GrapesJS 추후 적용)

## 프로젝트 구조 (`my-platform/`)
- /app/page.js → 랜딩
- /app/login → 로그인·회원가입
- /app/templates → 템플릿 선택 → /app/setup → 사이트 기본정보 생성
- /app/my → 고객 내 사이트·제작의뢰 목록
- /app/my/payment/one-time/[inquiryId] → 대리제작 잔금 결제 (method/card/bank-transfer)
- /app/platform → 본사 관리자 콘솔 (서버 가드 + Server Actions) — **사이트 중심 5메뉴**: 대시보드 · 사이트 · 회원 · 고객 요청 · 개발
- /app/s/[siteCode] → 사용자(방문자) 사이트 (멀티테넌트, `siteCode` = subdomain 우선, 없으면 site_code)
  - /board/[boardKey] → 게시판 (사이트당 여러 개, `user_boards`·`user_posts`·`user_comments`). 문의도 `qna` 게시판 — `/board` 는 첫 게시판으로 이동
  - /admin → **사장님 관리자** (아임웹식: 🔔알림 · 사이트 운영[대시보드·콘텐츠(게시물 관리·게시판 관리)] · 관리[결제·설정] · 도움[본사 요청]) — 메뉴 정의 `components/SiteAdminShell.js` `SITE_ADMIN_NAV`
  - /admin/editor → 심플 패널 에디터
  - /admin/payment/* → 구독 결제수단 등록 (method/card/bank-transfer)
- /app/api → `cron/billing`(청구 배치 목업) · `payment/billing-auth`(토스 빌링키) · `docs`(개발문서)
- /lib → 플로우·결제 (`flow-step`, `site-flow`, `site-visibility`, `managed-flow`, `deploy`, `trial`, `billing`, `billing-batch`, `subscription-life`, `payment/*`, `common-codes`, `use-flag`) · 게시판 (`user-board`, `user-board-public`) · 서버 (`supabase/server`, `supabase/admin`, `server/guard`)
- proxy.js → 서브도메인 rewrite + 세션 쿠키 갱신 (Next 16)

## DB 스키마 (현행)
> 명세: @my-platform/docs/플로우.md · @my-platform/docs/db/테이블명세.md · @my-platform/docs/db/ERD.md
> 최신 SQL: @my-platform/docs/db/sql/schema/schema_v2.3_2026-09-22.sql
> 테스트 데이터: @my-platform/docs/db/sql/sample/sample_data_v2.sql
> 마이그레이션: @my-platform/docs/db/sql/migrations/

### 주체 용어
- customers = 고객(사장님) · staff = 직원(본사) · user = 사용자(방문자, 공개 사이트 `user_*` 접두)

### 테이블
- customers: customer_id(PK), auth_id(FK→auth.users), email, name, phone, status, withdraw_at
- staff: staff_id(PK), auth_id(FK→auth.users), email, name, role, status
- templates: template_id(PK), name, category, default_content(JSONB)
- sites: site_id(UUID PK), site_code(VARCHAR URL식별자), customer_id(FK), template_id(FK), inquiry_id(FK), subdomain, domain, build_type(self/managed), **status(FLOW_STEP)**, trial_started_at, trial_ends_at
- subscriptions: subscription_id(PK), customer_id(FK), site_id(FK, UNIQUE), amount(30000), payment_method(manual/card), next_billing_date, cancelled_at, cancels_at — **status 없음**
- billing_history: billing_id(PK), subscription_id(FK), period, amount, status(unpaid/paid/overdue), pg_transaction_id
- one_time_payments: payment_id(PK), customer_id(FK), site_id(FK), type(domain_setup/dev_fee/extra), amount, status(unpaid/pending_confirm/paid)
- customer_payment_methods: payment_method_id(PK), customer_id(FK), pg_customer_id(빌링키), card_last4
- support_tickets: ticket_id(PK), site_id(FK), customer_id(FK), title, category, status — **고객→직원 수정요청**
- inquiries: inquiry_id(PK), customer_id(FK), dev_fee_total, down_paid_at, final_paid_at — **고객→직원 제작의뢰** (status 없음)
- user_boards: user_board_id(PK), site_id(FK), board_key(URL), name, board_type(notice/qna/general), sort_order — **고객 사이트 게시판 정의** (새 사이트 → 트리거로 공지사항·문의하기 자동 생성)
- user_posts: post_id(PK, URL호환), site_id(FK), user_board_id(FK), title, content, author, author_type(owner/user), is_private, phone, email — **게시판 글** (고객 문의 = qna 게시판 글)
- user_comments: user_comment_id(PK), post_id(FK), author_type(owner/user), author, content — **댓글** (사장님 답변 = owner 댓글). 답변 대기 = qna·user 글에 owner 댓글 없음 (`lib/user-board.js`)
- notification_logs: 청구 배치·알림톡 목업 로그 · common_codes: 공통코드(group_code+code)

## DB 핵심 규칙
- PK는 반드시 테이블명_id 형식 (예: customer_id, site_id, post_id)
- sites.site_id = UUID PK (FK 연결용)
- sites.site_code = VARCHAR (URL 식별자, 예: 'hongcafe_001')
- 혼용 금지: site_id는 UUID, site_code는 문자열
- 진도·공개·체험/구독/정지 = `sites.status` 하나. `deploy_status` · `inquiries.status` · `subscriptions.status` 는 삭제됨 (부활 금지)
- 삭제는 soft delete: `use_flag` 1=사용 · 0=삭제 (조회 기본 `use_flag = 1`)

## 개발 규칙
- 새 작업 시작 전 `my-platform/docs/작업이력/` 최신 {YYYY-MM-DD}_작업.md 파일을 반드시 읽고 시작할 것
- 작업 마무리 시 작업메모는 `my-platform/docs/작업이력/YYYY-MM-DD_작업.md` 에 남김 (`작업내역/` 폴더 사용 안 함)
- 작업 규칙 상세: `.cursor/rules/*.mdc` (수정 전 승인 · 전수/공통 먼저 · 플로우 변경 체크리스트 · 문서 3종)
- 코드 수정 시 AS-IS/TO-BE 형식으로 변경 부분만 제시
- Next.js 16 서버 컴포넌트: params는 await 처리
- Next.js 16 클라이언트 컴포넌트: params는 React.use() 사용
- 환경변수는 .env.local 사용 (Git 제외, 키 목록: `my-platform/.env.local.example`)
- DB 조회: `node docs/db/tools/db-query.mjs ...` (조회 전용)
- 전체 파일 새로 작성 시 압축파일로 폴더구조 포함하여 제공

## 개발 우선순위
- 1차 목표: 전체 프로세스 플로우 정의 및 동작 확인 (진행중)
- 2차 목표: 각 기능 세부 완성도 개선
- 3차 목표: GrapesJS 에디터 연동, 카드 결제(토스페이먼츠), 판매자 구조 추가

## 현재 진행 상황 (2026-09-26 기준)

### 보안 ①②③ (완료)
- `/platform` DB 조회·쓰기 = Server Actions + service role. 브라우저 anon 직접 호출 없음
- 세션 쿠키(`@supabase/ssr`) · `requireStaff()` 레이아웃 차단
- 고객 결제·상태 전환(`/s/.../admin` 서비스시작·카드·계좌·해지, `/my` 선금·잔금·접수취소) = Server Actions
- 셀프 흐름에 preview 없음 (`building → pay_method → trial → subscribed`)
- ③ 남은 쓰기(에디터·/setup·게시판·본사요청·가입·탈퇴) = Server Actions. 브라우저 insert/update/delete/upsert 0건
- 사장님 사이트 수정 허용: `name` · `description` · `address` · `phone` · `email` · `content` (`lib/site-edit.js`)
- 주소 규칙: `lib/subdomain-rules.js` (3~30자, 예약어, site_code VARCHAR(50))
- ④방문자 공개범위 게이트 구조 · ⑤RLS 잠금 은 다음 단계

### 결제·청구 (목업)
- 카드 등록: `app/s/[siteCode]/admin/payment/card/page.js` `MOCK_MODE = true` (실서비스 전환 시 false + 토스 키)
- 청구 배치: `lib/billing-batch.js` — 자동 cron 미연결, `/platform` 테스트 탭 또는 `POST /api/cron/billing`로 수동 실행
  - 카드: 청구일 다음날 결제(목업) → `billing_history` paid, `sites.status = subscribed`
  - 계좌: D-5~D-day 리마인드 로그, 미납 +2일 초과 → `suspended`
- 대리 잔금: 계좌이체 = OTP `pending_confirm` → 본사 확인 / 카드 = 목업 즉시 승인

### 다음 작업 후보 (미구현)
- 청구 배치 자동 실행(cron) 연결
- 토스페이먼츠 실결제 연동
- 보안 ④⑤: 방문자 공개범위 게이트 구조 · RLS 잠금 (현재 전 테이블 `USING (true)`, 조회는 아직 anon)
- 템플릿 고도화 (상위/left 메뉴 노코드 구성, 카드형 콘텐츠 등) · GrapesJS 에디터
- 판매자(에이전시) 구조
