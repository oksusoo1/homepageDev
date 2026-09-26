'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { requireAuthUser } from '@/lib/auth'
import { onlyActive } from '@/lib/use-flag'
import { siteAdminPath } from '@/lib/site-paths'

/**
 * 로그인 사용자 표시 (공통)
 * - guest: 로그인
 * - customer: 이름님 + email · 내 사이트 · 로그아웃
 * - staff: 이름님 + email · 콘솔 · 로그아웃
 *
 * siteCode: 공개 사이트 헤더에서 전달 — **그 사이트 주인에게만** 「관리자」 링크 표시
 *
 * @param {{ variant?: 'dark'|'light', showLogout?: boolean, className?: string, siteCode?: string, preset?: { status: string, kind: string, name: string, email: string }|null }} props
 */
export default function AuthUserBar({ variant = 'dark', showLogout = true, className = '', siteCode = '', preset = null, isSiteOwner = null }) {
  const pathname = usePathname()
  const [auth, setAuth] = useState({ status: 'loading', kind: null, name: '', email: '' })
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    if (preset) {
      setAuth(preset)
      if (typeof isSiteOwner === 'boolean') setIsOwner(isSiteOwner)
      return
    }
    let cancelled = false
    ;(async () => {
      const user = await requireAuthUser()
      if (cancelled) return
      if (!user) {
        setAuth({ status: 'guest', kind: null, name: '', email: '' })
        return
      }

      const { data: staff } = await onlyActive(
        supabase
          .from('staff')
          .select('name, email, role')
          .eq('auth_id', user.id)
          .eq('status', 'active')
      ).maybeSingle()
      if (cancelled) return
      if (staff?.role === 'platform_admin') {
        setAuth({
          status: 'ok',
          kind: 'staff',
          name: staff.name || '본사',
          email: staff.email || user.email || '',
        })
        return
      }

      const { data: customer } = await onlyActive(
        supabase.from('customers').select('customer_id, name, email').eq('auth_id', user.id)
      ).maybeSingle()
      if (cancelled) return
      if (customer) {
        if (siteCode) {
          const { data: site } = await onlyActive(
            supabase.from('sites').select('customer_id').eq('subdomain', siteCode)
          ).maybeSingle()
          if (cancelled) return
          setIsOwner(site?.customer_id === customer.customer_id)
        }
        setAuth({
          status: 'ok',
          kind: 'customer',
          name: customer.name || '회원',
          email: customer.email || user.email || '',
        })
        return
      }

      setAuth({ status: 'guest', kind: null, name: '', email: '' })
    })()
    return () => { cancelled = true }
  }, [siteCode, preset?.kind, preset?.name, preset?.email, isSiteOwner])

  async function handleLogout() {
    await supabase.auth.signOut()
    setAuth({ status: 'guest', kind: null, name: '', email: '' })
    window.location.href = '/login'
  }

  const dark = variant === 'dark'
  const muted = dark ? '#d6d3d1' : '#6b7280'
  const strong = dark ? '#fff' : '#111827'
  const staffAccent = dark ? '#fbbf24' : '#b45309'

  const linkStyle = {
    color: muted,
    textDecoration: 'none',
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  }

  const loginHref = `/login?next=${encodeURIComponent(pathname || '/')}`
  const onPlatform = pathname?.startsWith('/platform')
  const onMy = pathname === '/my' || pathname?.startsWith('/my/')

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
      }}
    >
      {auth.status === 'loading' && (
        <span style={{ fontSize: 12, color: muted }}>…</span>
      )}

      {auth.status === 'guest' && (
        <Link href={loginHref} style={{ ...linkStyle, fontSize: 13 }}>로그인</Link>
      )}

      {auth.status === 'ok' && (
        <>
          <div style={{ textAlign: 'right', lineHeight: 1.25 }}>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: auth.kind === 'staff' ? staffAccent : strong,
            }}>
              {auth.name}님
            </div>
            {auth.email && (
              <div style={{ fontSize: 10, color: muted, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {auth.email}
              </div>
            )}
          </div>
          {auth.kind === 'customer' && siteCode && isOwner && (
            <Link href={siteAdminPath(siteCode)} style={{ ...linkStyle, fontWeight: 700, color: strong }}>관리자</Link>
          )}
          {auth.kind === 'customer' && !siteCode && !onMy && (
            <Link href="/my" style={linkStyle}>내 사이트</Link>
          )}
          {auth.kind === 'staff' && !onPlatform && (
            <Link href="/platform" style={linkStyle}>콘솔</Link>
          )}
          {showLogout && (
            <button type="button" data-testid="auth-logout" onClick={handleLogout} style={linkStyle}>
              로그아웃
            </button>
          )}
        </>
      )}
    </div>
  )
}
