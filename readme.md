# 로컬 실행 방법



## 사전 요구

- Node.js (LTS)

- `my-platform/.env.local` (Supabase 키 등 — Git에 없음, 별도 복사)



## 실행 (수동)

```bash

cd my-platform

npm install

npm run dev

```



- `npm run dev` = `next dev --webpack` (Turbopack 사용 안 함)

- 브라우저: http://localhost:3000



## 테스트 계정

- `admin@myplatform.com` / `admin1234`
- `test@test.com` / `test123`
- `test2@test.com` / `test123`

- 관리자: http://localhost:3000/platform



---



## PM2 자동 실행 (권장 설정)



PC 부팅 시 `시작프로그램\PM2-MyPlatform.lnk` → `my-platform\pm2-startup.bat` → `pm2 resurrect` 로 복원됩니다.



### 왜 webpack인가

- 앱은 `my-platform`, Git 루트는 상위 `homepageDev`

- Turbopack이 상위에서 `tailwindcss`를 찾아 실패하고, 프로세스/컴파일이 비정상해짐

- 개발은 **webpack**으로 고정



### PM2 조작은 관리자 PowerShell에서

- Cursor 일반 터미널: `EPERM //./pipe/rpc.sock` (관리자 PM2 데몬에 접근 불가)

- **관리자: Windows PowerShell** 에서만 `pm2` 명령 사용



### 성공한 등록 방법

```powershell

cd C:\git_repo\homepageDev\my-platform



pm2 delete my-platform

pm2 start .\node_modules\next\dist\bin\next --name my-platform -- -- dev --webpack

pm2 save

pm2 logs my-platform --lines 40

```



- PowerShell에서는 `--`를 **두 번** (`-- --`) 써야 인자가 `next`로 전달됨

- 저장 인자: `args: ["dev", "--webpack"]`

- 성공 로그: `▲ Next.js 16.x.x (webpack)` / `✓ Ready`



### 쓰지 말 것 (Windows에서 실패)

```powershell

pm2 start npm --name my-platform -- run dev          # Script not found / NPM.CMD SyntaxError

pm2 start cmd --name my-platform -- /c "npm run dev" # Script not found: C:\c

pm2 start ... --name my-platform -- dev --webpack    # -- 한 번만 → PowerShell/PM2가 인자 깨먹음

```



### 확인 / 재시작

```powershell

pm2 list

pm2 restart my-platform

pm2 logs my-platform --lines 20

```



`aifront` 등 다른 PM2 앱은 건드리지 말 것.



---



## 포트 정리 / 캐시 (수동 실행 시)



```powershell

# 3000 포트 종료

Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |

  Select-Object -ExpandProperty OwningProcess -Unique |

  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }



# 캐시 삭제 후 재실행 (안 될 때)

cd C:\git_repo\homepageDev\my-platform

Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

npm run dev

```



---



## Cursor 규칙 (AI 작업용)



위치: `.cursor/rules/` (저장소 루트 `homepageDev` 기준, `alwaysApply: true`)



| 파일 | 요약 |
|------|------|
| `ask-before-edit.mdc` | 파일/설정 변경 전 승인 필수. 계획 → 동의 → 한 단계씩 |
| `simple-platform.mdc` | UX·코드 심플. 중복 UI/과한 분기 금지 |
| `process-impact.mdc` | 상태·결제·프리셋 변경 시 정방향 프로세스·영향 범위(/platform, /my 등) 선검토 |



- 규칙 추가·수정 시 이 표도 같이 갱신한다.

- 메인 플로우 스텝: `FLOW_STEP` 공통코드 + `my-platform/lib/flow-step.js`  
  (시드 SQL: `my-platform/docs/db/sql/migrations/013_flow_step.sql`)

