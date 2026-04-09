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
cd C:\git_repo\semina\project\homepageDev\my-platform
npm run dev
```

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
