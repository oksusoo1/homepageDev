# DB 조회 CLI (개발용)

Supabase JS로 `.env.local` 연결해 테이블을 조회합니다.  
에이전트/로컬에서 **데이터 확인용**이며, 마이그레이션·쓰기용은 아닙니다.

## 준비

`my-platform/.env.local`에 다음이 있어야 합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- (권장) `SUPABASE_SERVICE_ROLE_KEY` — 있으면 RLS 우회로 조회가 더 안정적

## 실행

```bash
cd my-platform

node docs/db/tools/db-query.mjs snapshot
node docs/db/tools/db-query.mjs related --email test2@test.com
node docs/db/tools/db-query.mjs sites --build_type managed
node docs/db/tools/db-query.mjs inquiries --email test2@test.com
```

기본은 `use_flag = 1`만 조회. 삭제분 포함: `--all`
