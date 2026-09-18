'use client'

import Link from 'next/link'
import { sitePublicPath } from '@/lib/site-paths'
import AuthUserBar from '@/components/AuthUserBar'

/**
 * 방문자 사이트 공통 헤더
 * - 네비: 홈 / 게시판 / 문의
 * - 우측: AuthUserBar (이름+이메일)
 */
export default function SiteHeader({
  siteName,
  siteCode,
  domain,
  bgColor = '#1c1917',
  activePage = '',
}) {
  const code = siteCode || (domain ? String(domain).split('.')[0] : '')

  const navItems = [
    { label: '홈', href: code ? sitePublicPath(code) : '#', key: 'home' },
    { label: '게시판', href: code ? sitePublicPath(code, '/board') : '#', key: 'board' },
    { label: '문의', href: code ? sitePublicPath(code, '/contact') : '#', key: 'contact' },
  ]

  return (
    <header style={{
      background: bgColor, color: 'white',
      padding: '0 20px', height: 64,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <Link href={code ? sitePublicPath(code) : '#'} style={{
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

        <AuthUserBar variant="dark" />
      </nav>
    </header>
  )
}
