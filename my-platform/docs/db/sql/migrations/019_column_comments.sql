-- ================================================
-- 019_column_comments.sql
-- 모든 테이블·컬럼 COMMENT (Supabase Table Editor / \d+ 에서 보이게)
-- ================================================

-- ---------- customers ----------
COMMENT ON TABLE customers IS '고객(사장님) 프로필. auth.users 와 auth_id 로 연결';
COMMENT ON COLUMN customers.customer_id IS 'PK';
COMMENT ON COLUMN customers.email IS '로그인·연락 이메일 (UNIQUE)';
COMMENT ON COLUMN customers.name IS '고객 이름';
COMMENT ON COLUMN customers.phone IS '연락처';
COMMENT ON COLUMN customers.status IS '계정 상태: active(정상) | suspended(정지) | withdrawn(탈퇴)';
COMMENT ON COLUMN customers.created_at IS '생성 시각';
COMMENT ON COLUMN customers.updated_at IS '수정 시각';
COMMENT ON COLUMN customers.auth_id IS 'Supabase Auth 사용자 ID → auth.users(id)';
COMMENT ON COLUMN customers.use_flag IS '1=사용 · 0=삭제(소프트딜리트). 조회 기본 1';
COMMENT ON COLUMN customers.withdraw_at IS '탈퇴 예약일. 미래=잔여기간 대기(로그인 가능), 과거=청구 배치에서 withdrawn 처리';

-- ---------- staff ----------
COMMENT ON TABLE staff IS '본사 직원. /platform 접근 (role=platform_admin)';
COMMENT ON COLUMN staff.staff_id IS 'PK';
COMMENT ON COLUMN staff.auth_id IS 'Supabase Auth 사용자 ID → auth.users(id)';
COMMENT ON COLUMN staff.email IS '직원 이메일 (UNIQUE)';
COMMENT ON COLUMN staff.name IS '직원 이름';
COMMENT ON COLUMN staff.role IS '역할: platform_admin | support | viewer';
COMMENT ON COLUMN staff.status IS '재직 상태: active | suspended | left';
COMMENT ON COLUMN staff.created_at IS '생성 시각';
COMMENT ON COLUMN staff.updated_at IS '수정 시각';
COMMENT ON COLUMN staff.use_flag IS '1=사용 · 0=삭제';

-- ---------- templates ----------
COMMENT ON TABLE templates IS '사이트 템플릿 마스터';
COMMENT ON COLUMN templates.template_id IS 'PK';
COMMENT ON COLUMN templates.name IS '템플릿 표시명';
COMMENT ON COLUMN templates.category IS '업종 카테고리 (cafe, restaurant, salon, clinic, academy, general …)';
COMMENT ON COLUMN templates.thumbnail_url IS '목록 썸네일 URL';
COMMENT ON COLUMN templates.default_content IS '템플릿 기본 content(JSONB) — 사이트 생성 시 복사';
COMMENT ON COLUMN templates.sort_order IS '목록 정렬 순서 (작을수록 앞)';
COMMENT ON COLUMN templates.created_at IS '생성 시각';
COMMENT ON COLUMN templates.use_flag IS '1=사용 · 0=삭제';

-- ---------- sites ----------
COMMENT ON TABLE sites IS '사이트. status=FLOW_STEP 이 진도·공개·체험/구독/정지의 SSOT';
COMMENT ON COLUMN sites.site_id IS 'PK (UUID). FK 연결용';
COMMENT ON COLUMN sites.site_code IS 'URL·내부 식별 문자열 (예: hongcafe_001). site_id 와 혼용 금지';
COMMENT ON COLUMN sites.customer_id IS '소유 고객 → customers';
COMMENT ON COLUMN sites.template_id IS '사용 템플릿 → templates';
COMMENT ON COLUMN sites.name IS '사이트(상호) 이름';
COMMENT ON COLUMN sites.subdomain IS '서브도메인 (공개 URL 경로 식별)';
COMMENT ON COLUMN sites.domain IS '커스텀 도메인 (선택)';
COMMENT ON COLUMN sites.description IS '소개/설명';
COMMENT ON COLUMN sites.address IS '주소';
COMMENT ON COLUMN sites.phone IS '사이트 표시 전화';
COMMENT ON COLUMN sites.email IS '사이트 표시 이메일';
COMMENT ON COLUMN sites.build_type IS '제작 방식: self(고객직접) | managed(본사대리)';
COMMENT ON COLUMN sites.content IS '에디터 콘텐츠·설정 JSONB';
COMMENT ON COLUMN sites.status IS 'FLOW_STEP SSOT: intake|deposit|building|preview|balance|pay_method|trial|subscribed|suspended';
COMMENT ON COLUMN sites.created_at IS '생성 시각';
COMMENT ON COLUMN sites.updated_at IS '수정 시각';
COMMENT ON COLUMN sites.trial_started_at IS '무료 체험 시작 시각';
COMMENT ON COLUMN sites.trial_ends_at IS '무료 체험 종료 시각';
COMMENT ON COLUMN sites.inquiry_id IS '대리제작 시 연결 문의 → inquiries';
COMMENT ON COLUMN sites.use_flag IS '1=사용 · 0=삭제';

-- ---------- one_time_payments ----------
COMMENT ON TABLE one_time_payments IS '1회성 결제 (개발비·도메인 대행 등)';
COMMENT ON COLUMN one_time_payments.payment_id IS 'PK';
COMMENT ON COLUMN one_time_payments.customer_id IS '결제 고객 → customers';
COMMENT ON COLUMN one_time_payments.site_id IS '관련 사이트 → sites (선택)';
COMMENT ON COLUMN one_time_payments.type IS '종류: domain_setup | dev_fee | extra';
COMMENT ON COLUMN one_time_payments.amount IS '금액(원)';
COMMENT ON COLUMN one_time_payments.status IS 'unpaid | pending_confirm(입금확인대기) | paid';
COMMENT ON COLUMN one_time_payments.note IS '메모·안내';
COMMENT ON COLUMN one_time_payments.paid_at IS '납부 확인 시각';
COMMENT ON COLUMN one_time_payments.created_at IS '생성 시각';
COMMENT ON COLUMN one_time_payments.use_flag IS '1=사용 · 0=삭제';

-- ---------- customer_payment_methods ----------
COMMENT ON TABLE customer_payment_methods IS '고객 카드(빌링키) 등록';
COMMENT ON COLUMN customer_payment_methods.payment_method_id IS 'PK';
COMMENT ON COLUMN customer_payment_methods.customer_id IS '고객 → customers';
COMMENT ON COLUMN customer_payment_methods.pg_provider IS 'PG사 (예: toss)';
COMMENT ON COLUMN customer_payment_methods.pg_customer_id IS 'PG 빌링키';
COMMENT ON COLUMN customer_payment_methods.card_last4 IS '카드 끝 4자리';
COMMENT ON COLUMN customer_payment_methods.card_brand IS '카드 브랜드/발급사';
COMMENT ON COLUMN customer_payment_methods.card_name IS '카드 별칭';
COMMENT ON COLUMN customer_payment_methods.registered_at IS '등록 시각';
COMMENT ON COLUMN customer_payment_methods.created_at IS '생성 시각';
COMMENT ON COLUMN customer_payment_methods.use_flag IS '1=사용 · 0=삭제';

-- ---------- subscriptions ----------
COMMENT ON TABLE subscriptions IS '월 구독·청구 일정. 체험/구독/정지는 sites.status. status 컬럼 없음';
COMMENT ON COLUMN subscriptions.subscription_id IS 'PK';
COMMENT ON COLUMN subscriptions.customer_id IS '고객 → customers';
COMMENT ON COLUMN subscriptions.site_id IS '사이트 → sites (사이트당 1행 UNIQUE)';
COMMENT ON COLUMN subscriptions.amount IS '월 구독료(원). 기본 30000';
COMMENT ON COLUMN subscriptions.billing_day IS '매월 청구일 (1~28)';
COMMENT ON COLUMN subscriptions.payment_method IS 'manual(계좌) | card(자동카드)';
COMMENT ON COLUMN subscriptions.started_at IS '구독 행 시작 시각';
COMMENT ON COLUMN subscriptions.next_billing_date IS '다음 청구일';
COMMENT ON COLUMN subscriptions.cancelled_at IS '해지 요청(예약) 시각';
COMMENT ON COLUMN subscriptions.created_at IS '생성 시각';
COMMENT ON COLUMN subscriptions.updated_at IS '수정 시각';
COMMENT ON COLUMN subscriptions.cancels_at IS '서비스 종료 예정일. 경과 시 sites→suspended';
COMMENT ON COLUMN subscriptions.depositor_name IS '계좌이체 입금자명';
COMMENT ON COLUMN subscriptions.bank_transfer_agreed_at IS '계좌이체 약정 시각';
COMMENT ON COLUMN subscriptions.use_flag IS '1=사용 · 0=삭제';

-- ---------- billing_history ----------
COMMENT ON TABLE billing_history IS '월별 청구·납부 이력. UNIQUE(subscription_id, period)';
COMMENT ON COLUMN billing_history.billing_id IS 'PK';
COMMENT ON COLUMN billing_history.subscription_id IS '구독 → subscriptions';
COMMENT ON COLUMN billing_history.period IS '청구 월 YYYY-MM';
COMMENT ON COLUMN billing_history.amount IS '청구 금액(원)';
COMMENT ON COLUMN billing_history.status IS 'unpaid | paid | overdue';
COMMENT ON COLUMN billing_history.payment_method IS 'manual | card';
COMMENT ON COLUMN billing_history.paid_at IS '납부 완료 시각';
COMMENT ON COLUMN billing_history.pg_transaction_id IS 'PG 거래 ID';
COMMENT ON COLUMN billing_history.note IS '비고';
COMMENT ON COLUMN billing_history.created_at IS '생성 시각';
COMMENT ON COLUMN billing_history.due_at IS '납부 기한(계좌이체)';
COMMENT ON COLUMN billing_history.use_flag IS '1=사용 · 0=삭제';

-- ---------- support_tickets ----------
COMMENT ON TABLE support_tickets IS '고객→직원 수정요청 (/my). user_messages·inquiries 와 구분';
COMMENT ON COLUMN support_tickets.ticket_id IS 'PK';
COMMENT ON COLUMN support_tickets.site_id IS '대상 사이트 → sites';
COMMENT ON COLUMN support_tickets.customer_id IS '요청 고객 → customers';
COMMENT ON COLUMN support_tickets.title IS '제목';
COMMENT ON COLUMN support_tickets.content IS '요청 내용';
COMMENT ON COLUMN support_tickets.category IS 'text_change|image|page_add|feature|etc';
COMMENT ON COLUMN support_tickets.status IS 'open|in_progress|resolved';
COMMENT ON COLUMN support_tickets.priority IS 'low|normal|high|urgent';
COMMENT ON COLUMN support_tickets.deadline_days IS '처리 기한 일수 (기본 3). INSERT 시 deadline_at 계산';
COMMENT ON COLUMN support_tickets.deadline_at IS '처리 마감 시각 (트리거 자동)';
COMMENT ON COLUMN support_tickets.resolved_at IS '완료 시각';
COMMENT ON COLUMN support_tickets.created_at IS '생성 시각';
COMMENT ON COLUMN support_tickets.updated_at IS '수정 시각';
COMMENT ON COLUMN support_tickets.use_flag IS '1=사용 · 0=삭제';

-- ---------- inquiries ----------
COMMENT ON TABLE inquiries IS '고객→직원 대리제작 의뢰. 진도는 sites.status. 여기선 금액·납부일만';
COMMENT ON COLUMN inquiries.inquiry_id IS 'PK';
COMMENT ON COLUMN inquiries.customer_id IS '의뢰 고객 → customers';
COMMENT ON COLUMN inquiries.business_type IS '업종 (cafe, restaurant, salon …)';
COMMENT ON COLUMN inquiries.description IS '원하는 사이트 설명';
COMMENT ON COLUMN inquiries.phone IS '연락받을 전화';
COMMENT ON COLUMN inquiries.admin_note IS '본사 직원 메모';
COMMENT ON COLUMN inquiries.created_at IS '생성 시각';
COMMENT ON COLUMN inquiries.updated_at IS '수정 시각';
COMMENT ON COLUMN inquiries.dev_fee_total IS '총 개발비(견적, 원)';
COMMENT ON COLUMN inquiries.down_paid_at IS '선금 확인 시각';
COMMENT ON COLUMN inquiries.final_paid_at IS '잔금 확인 시각';
COMMENT ON COLUMN inquiries.use_flag IS '1=사용 · 0=삭제';

-- ---------- user_posts ----------
COMMENT ON TABLE user_posts IS '방문자 사이트 게시판. PK 컬럼명 post_id (URL 호환)';
COMMENT ON COLUMN user_posts.post_id IS 'PK (예외 명명 — URL /board/[post_id])';
COMMENT ON COLUMN user_posts.site_id IS '사이트 → sites';
COMMENT ON COLUMN user_posts.title IS '글 제목';
COMMENT ON COLUMN user_posts.content IS '글 본문';
COMMENT ON COLUMN user_posts.author IS '작성자 표시명';
COMMENT ON COLUMN user_posts.created_at IS '작성 시각';
COMMENT ON COLUMN user_posts.use_flag IS '1=사용 · 0=삭제';

-- ---------- user_messages ----------
COMMENT ON TABLE user_messages IS '방문자→고객 문의 (/s/.../contact)';
COMMENT ON COLUMN user_messages.user_message_id IS 'PK';
COMMENT ON COLUMN user_messages.site_id IS '사이트 → sites';
COMMENT ON COLUMN user_messages.name IS '문의자 이름';
COMMENT ON COLUMN user_messages.phone IS '문의자 전화';
COMMENT ON COLUMN user_messages.email IS '문의자 이메일';
COMMENT ON COLUMN user_messages.content IS '문의 내용';
COMMENT ON COLUMN user_messages.status IS 'new|replied|done';
COMMENT ON COLUMN user_messages.use_flag IS '1=사용 · 0=삭제';
COMMENT ON COLUMN user_messages.created_at IS '접수 시각';
COMMENT ON COLUMN user_messages.updated_at IS '수정 시각';
COMMENT ON COLUMN user_messages.is_private IS 'true=비공개 (공개 목록에서 본문 숨김)';
COMMENT ON COLUMN user_messages.reply_content IS '고객(운영자) 답글';
COMMENT ON COLUMN user_messages.replied_at IS '답글 시각';

-- ---------- notification_logs ----------
COMMENT ON TABLE notification_logs IS '청구 배치·알림톡 목업 로그';
COMMENT ON COLUMN notification_logs.notification_log_id IS 'PK';
COMMENT ON COLUMN notification_logs.type IS '알림 종류: bank_remind|bank_suspend|card_charged …';
COMMENT ON COLUMN notification_logs.channel IS '채널 (기본 mock_alimtalk)';
COMMENT ON COLUMN notification_logs.site_id IS '관련 사이트 → sites';
COMMENT ON COLUMN notification_logs.customer_id IS '관련 고객 → customers';
COMMENT ON COLUMN notification_logs.subscription_id IS '관련 구독 → subscriptions';
COMMENT ON COLUMN notification_logs.payload IS '알림 본문·메타 JSONB';
COMMENT ON COLUMN notification_logs.as_of_date IS '배치 기준일(가상 오늘)';
COMMENT ON COLUMN notification_logs.use_flag IS '1=사용 · 0=삭제';
COMMENT ON COLUMN notification_logs.created_at IS '기록 시각';

-- ---------- common_codes ----------
COMMENT ON TABLE common_codes IS '공통코드. group_code+code 불변, label/설명/순서/사용만 변경. (구 code_groups 없음)';
COMMENT ON COLUMN common_codes.common_code_id IS 'PK';
COMMENT ON COLUMN common_codes.code IS '저장·비교에 쓰는 코드값 (불변). 예: trial, card';
COMMENT ON COLUMN common_codes.label IS '화면 표시명. 예: 체험, 카드';
COMMENT ON COLUMN common_codes.description IS '코드 설명';
COMMENT ON COLUMN common_codes.sort_order IS '그룹 내 정렬 순서';
COMMENT ON COLUMN common_codes.use_flag IS '1=사용 · 0=미사용(라벨 조회에서 제외)';
COMMENT ON COLUMN common_codes.created_at IS '생성 시각';
COMMENT ON COLUMN common_codes.updated_at IS '수정 시각';
COMMENT ON COLUMN common_codes.group_code IS '그룹. 예: FLOW_STEP, PAYMENT_METHOD, OTP_STATUS';
