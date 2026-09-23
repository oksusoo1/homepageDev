'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { sitePublicPath, boardPath } from '@/lib/site-paths'
import AuthUserBar from '@/components/AuthUserBar'

/**
 * 고객(방문자) 사이트 공통 헤더
 * - 네비: 홈 + 사이트 게시판(user_boards 정렬순)
 * - activePage: 'home' | 게시판 board_key
 * - 우측: AuthUserBar (이름+이메일)
 */
export default function SiteHeader({
  siteName,
  siteCode,
  bgColor = '#1c1917',
  activePage = '',
}) {
  const [boards, setBoards] = useState([])

  useEffect(() => {
    if (!siteCode) return
    supabase
      .from('user_boards')
      .select('board_key, name, sort_order, sites!inner(subdomain)')
      .eq('sites.subdomain', siteCode)
      .eq('use_flag', 1)
      .order('sort_order')
      .then(({ data }) => setBoards(data || []))
  }, [siteCode])

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

        <AuthUserBar variant="dark" siteCode={siteCode} />
      </nav>
    </header>
  )
}
