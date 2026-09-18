'use client'

import Link from 'next/link'
import AuthUserBar from '@/components/AuthUserBar'

/** 랜딩 상단 — 로그인 상태에 따라 AuthUserBar + CTA */
export default function LandingHeader() {
  return (
    <header className="flex items-center justify-between px-6 md:px-12 h-16 border-b border-[#1f1f1f]">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[15px] text-[#0a0a0a] font-black">
          M
        </div>
        <span className="text-[15px] font-bold tracking-tight">MyPlatform</span>
      </div>
      <div className="flex gap-3 items-center">
        <AuthUserBar variant="dark" />
        <Link
          href="/login?tab=signup"
          className="text-[13px] text-[#0a0a0a] bg-white no-underline px-4 py-1.5 rounded-lg font-bold"
        >
          무료 시작하기
        </Link>
      </div>
    </header>
  )
}
