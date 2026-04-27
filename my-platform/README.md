This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).


*** 테스트 계정 ***
# test@test.com | test123 | 테스트1
# wonse@hos.com | test123 | 김운서
# 테스트 카드번호: 4330 0000 0000 0001 (비밀번호/유효기간 아무거나) 

*** 사이트 ***
# 고객포탈 
  랜딩페이지 : http://localhost:3000/ 
  내사이트 메인 : http://localhost:3000/my
  내사이트 관리 : http://localhost:3000/my/testcafe
  내사이트 카드 등록/구독 : http://localhost:3000/payment/card?site_id=fda7e61c-3c0e-4594-a1a4-a5c74cb760f6
  내사이트 수정 : http://localhost:3000/editor/testcafe

  템플릿 : http://localhost:3000/templates


# 고객사이트 
  고객홈페이지 : http://localhost:3000/preview/[subdomain]
              http://localhost:3000/preview/testcafe




# 플랫폼페이지 
  랜딩페이지 : http://localhost:3000/platform
  



### Step 5: 동작 확인 순서
```
cd C:\git_repo\homepageDev\my-platform
npm run dev
```

---

### PM2 설치 (최초 1회 — PC에 이미 설치됨)
```
npm install -g pm2
```
Windows 자동시작 설정:
- `pm2 save` 로 프로세스 목록 저장 → `C:\Users\iiyma\.pm2\dump.pm2`
- 시작 프로그램 폴더에 바로가기 등록 (`pm2-startup.bat` → `pm2 resurrect` 실행)
  위치: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\PM2-MyPlatform.lnk`
- 로그인 시 PM2 데몬이 dump.pm2 기반으로 프로세스 자동 복원

> Task Scheduler는 관리자 권한 필요로 시작 프로그램 폴더 방식 사용

**ecosystem.config.js 핵심 설정:**
- Windows에서 `npm` / `cmd.exe /c npm run dev` 방식은 모두 오류 발생
- `node_modules/next/dist/bin/next` 를 직접 Node.js 스크립트로 실행해야 정상 동작
- `npm run dev` → 내부적으로 shell script 경유 → Windows Node.js 에서 파싱 오류
- Next.js 바이너리 직접 지정 시 cwd 도 정확히 적용되어 tailwindcss 모듈 해석 오류도 해결됨

---

### PM2 백그라운드 실행 (자동시작 설정됨)
```
pm2 start ecosystem.config.js   # 시작
pm2 list                         # 상태 확인
pm2 logs my-platform             # 로그 확인
pm2 stop my-platform             # 중지
pm2 restart my-platform          # 재시작
pm2 save                         # 현재 상태 저장 (자동시작 목록 갱신)
```
PC 로그인 시 자동 실행됨.
시작 프로그램: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\PM2-MyPlatform.lnk`

---

### 외부 접속
| 환경 | URL |
|------|-----|
| 내부망 IP | http://192.168.0.22:3000 |
| 외부망 DDNS | http://spboxwin.iptime.org:3000 |

next.config.mjs `allowedDevOrigins`에 등록됨. 공유기 포트포워딩 3000 필요.

---

### 설정 파일
| 파일 | 설명 |
|------|------|
| `next.config.mjs` | allowedDevOrigins — IP/DDNS 외부 접속 허용 |
| `proxy.js` | 도메인 기반 라우팅 (구 middleware.js, Next.js 16 변경) |
| `ecosystem.config.js` | PM2 프로세스 설정 |
| `.env.local` | 환경변수 (Git 제외) |

---

**5. 동작 확인 순서**
```
1. 로그인 
http://localhost:3000/
test@test.com
test123

http://localhost:3000/my


localhost:3000/platform
  → 관리자 콘솔 열리는지

localhost:3000/preview/hongcafe
  → 홍길동 카페 사이트 보이는지

localhost:3000/preview/hongcafe/board
  → 게시판 목록 보이는지

localhost:3000/preview/hongcafe/contact
  → 문의 폼 보이는지
   

https://supabase.com/dashboard/project/pavvmktfbkpdtaayvplf



## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
