import Link from 'next/link'
import { sitePublicPath } from '@/lib/site-paths'

/**
 * 방문자 사이트 공통 헤더
 * /s/[siteCode] 하위 페이지에서 공유
 */
export default function SiteHeader({ siteName, siteCode, bgColor = '#1c1917', activePage = '' }) {
  const navItems = [
    { label: '홈', href: sitePublicPath(siteCode), key: 'home' },
    { label: '게시판', href: sitePublicPath(siteCode, '/board'), key: 'board' },
    { label: '문의', href: sitePublicPath(siteCode, '/contact'), key: 'contact' },
  ]

  return (
    <header style={{
      background: bgColor, color: 'white',
      padding: '0 40px', height: 64,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <Link href={sitePublicPath(siteCode)} style={{
        color: 'white', textDecoration: 'none',
        fontSize: 20, fontWeight: 600, letterSpacing: '-0.5px',
      }}>
        {siteName}
      </Link>
      <nav style={{ display: 'flex', gap: 28 }}>
        {navItems.map(({ label, href, key }) => (
          <Link key={key} href={href} style={{
            color: activePage === key ? 'white' : '#d6d3d1',
            textDecoration: 'none', fontSize: 14,
            fontWeight: activePage === key ? 600 : 400,
          }}>
            {label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
