'use client'

import Link from 'next/link'
import { sitePublicPath, boardPath } from '@/lib/site-paths'
import AuthUserBar from '@/components/AuthUserBar'

/**
 * 고객(방문자) 사이트 공통 헤더
 * 게시판 목록은 서버에서 받아 표시 (브라우저 supabase 조회 없음)
 */
export default function SiteHeader({
  siteName,
  siteCode,
  boards = [],
  bgColor = '#1c1917',
  activePage = '',
  authPreset = null,
  isSiteOwner = false,
}) {
  const navItems = [
    { label: '홈', href: sitePublicPath(siteCode), key: 'home' },
    ...boards.map(b => ({ label: b.name, href: boardPath(siteCode, b.board_key), key: b.board_key })),
  ]

  return (
    <header style={{
      background: bgColor, color: 'white',
      padding: '0 20px', height: 64,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <Link href={sitePublicPath(siteCode)} style={{
        color: 'white', textDecoration: 'none',
        fontSize: 18, fontWeight: 600, letterSpacing: '-0.5px', flexShrink: 0,
      }}>
        {siteName}
      </Link>

      <nav style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {navItems.map(({ label, href, key }) => (
          <Link key={key} href={href} style={{
            color: activePage === key ? 'white' : '#d6d3d1',
            textDecoration: 'none', fontSize: 13,
            fontWeight: activePage === key ? 600 : 400,
          }}>
            {label}
          </Link>
        ))}

        <span style={{ width: 1, height: 14, background: '#57534e', flexShrink: 0 }} aria-hidden />

        <AuthUserBar variant="dark" siteCode={siteCode} preset={authPreset} isSiteOwner={isSiteOwner} />
      </nav>
    </header>
  )
}
