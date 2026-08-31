# 데이터베이스 (Supabase)

SQL 스크립트와 스키마 명세는 **`docs/db/`** 에서 관리합니다.

## 빠른 링크

| 용도 | 경로 |
|------|------|
| 스키마 명세 (HTML) | [docs/db/스키마_버전목록.html](docs/db/스키마_버전목록.html) |
| ERD | [docs/db/ERD_v1.0_2026-08-31.html](docs/db/ERD_v1.0_2026-08-31.html) |
| 최신 전체 스키마 | [docs/db/sql/schema/schema_v2.1_2026-08-31.sql](docs/db/sql/schema/schema_v2.1_2026-08-31.sql) |
| 증분 마이그레이션 | [docs/db/sql/migrations/](docs/db/sql/migrations/) |
| 테스트 데이터 | [docs/db/sql/sample/sample_data_v2.sql](docs/db/sql/sample/sample_data_v2.sql) |

## 인증

- `auth.users` — Supabase 로그인 (비밀번호)
- `customers` — 고객 프로필
- `staff` — 본사 직원 (`role=platform_admin` → `/platform`)

관리자 등록: UI Create user + `staff` INSERT. 상세는 `docs/db/스키마_v1.1_2026-08-31.html`

## 실행 순서

### 신규 DB (처음부터)

1. `docs/db/sql/schema/schema_v2.1_2026-08-31.sql`
2. (선택) `docs/db/sql/sample/sample_data_v2.sql`

### 기존 DB (mvp_v2 이미 적용됨)

1. `docs/db/sql/migrations/001_add_missing_columns.sql` (미적용 시)
2. `docs/db/sql/migrations/002_add_staff_table.sql`

## 인증 테이블

- `auth.users` — Supabase Auth 내장 (비밀번호·세션)
- `public.customers` — 고객 프로필 (`auth_id` 연결)
- `public.staff` — 본사 직원 (`auth_id` 연결, `/platform` 권한)
