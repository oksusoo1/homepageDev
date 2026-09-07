# 데이터베이스 (Supabase)

SQL 스크립트와 스키마 명세는 **`docs/db/`** 에서 관리합니다.

## 빠른 링크

| 용도 | 경로 |
|------|------|
| 스키마 명세 (HTML) | [docs/db/스키마_버전목록.html](docs/db/스키마_버전목록.html) · [v1.2](docs/db/스키마_v1.2_2026-09-07.html) |
| ERD | [docs/db/ERD_v1.1_2026-09-07.html](docs/db/ERD_v1.1_2026-09-07.html) |
| 최신 전체 스키마 | [docs/db/sql/schema/schema_v2.1_2026-08-31.sql](docs/db/sql/schema/schema_v2.1_2026-08-31.sql) |
| 증분 마이그레이션 | [docs/db/sql/migrations/](docs/db/sql/migrations/) |
| 테스트 데이터 | [docs/db/sql/sample/sample_data_v2.sql](docs/db/sql/sample/sample_data_v2.sql) |

## 주체 용어

| 용어 | DB | 설명 |
|------|-----|------|
| 고객 | `customers` | 사장님(소상공인) |
| 직원 | `staff` | 본사 · `/platform` |
| 사용자 | `user_*` 접두 | 공개 사이트 방문자 · `user_posts`, `user_messages` |

## 문의·요청 구분

| 테이블 | 방향 | UI |
|--------|------|-----|
| `user_messages` | 사용자 → 고객 | `/s/{siteCode}/contact` |
| `support_tickets` | 고객 → 직원 | `/my` 수정요청 |
| `inquiries` | 고객 → 직원 | `/my` 제작의뢰 |

## 인증

- `auth.users` — Supabase 로그인 (비밀번호)
- `customers` — 고객 프로필
- `staff` — 본사 직원 (`role=platform_admin` → `/platform`)

관리자 등록: UI Create user + `staff` INSERT. 상세는 `docs/db/스키마_v1.2_2026-09-07.html`

## 실행 순서

### 신규 DB (처음부터)

1. `docs/db/sql/schema/schema_v2.1_2026-08-31.sql`
2. (선택) `docs/db/sql/sample/sample_data_v2.sql`

### 기존 DB (mvp_v2 이미 적용됨)

1. `001` ~ `006` (미적용분만)
3. `007_user_messages.sql` ~ `010_notification_logs.sql`
