'use client'

import Link from 'next/link'
import { siteAdminPath, sitePublicPath, sitePublicHostname } from '@/lib/site-paths'
import { codeLabel } from '@/lib/common-codes'
import AuthUserBar from '@/components/AuthUserBar'

/**
 * 사장님 사이트 관리 — left 메뉴 셸 (아임웹보다 단순한 3그룹)
 */
export const SITE_ADMIN_NAV = [
  {
    key: 'site',
    label: '내 사이트',
    icon: '🏠',
    children: [
      { key: 'site.basics', label: '기본 정보' },
      { key: 'site.deploy', label: '배포 · 운영' },
      { key: 'site.info', label: '사이트 정보' },
    ],
  },
  {
    key: 'comm',
    label: '소통',
    icon: '💬',
    children: [
      { key: 'comm.request', label: '수정 요청' },
      { key: 'comm.status', label: '요청 현황' },
    ],
  },
  {
    key: 'billing',
    label: '결제',
    icon: '💳',
    children: [
      { key: 'billing.sub', label: '구독 · 결제수단' },
      { key: 'billing.history', label: '결제 내역' },
      { key: 'billing.account', label: '회원 탈퇴' },
    ],
  },
]

export function findNavLabel(menuKey) {
  for (const g of SITE_ADMIN_NAV) {
    const hit = g.children.find(c => c.key === menuKey)
    if (hit) return hit.label
  }
  return ''
}

export function parentKeyOf(menuKey) {
  return menuKey?.split('.')[0] || 'site'
}

export default function SiteAdminShell({
  site,
  siteCode,
  customer = null,
  menuKey,
  onMenuChange,
  openGroups,
  onToggleGroup,
  pendingTicketCount = 0,
  mobileOpen,
  onMobileOpen,
  onLogout,
  children,
}) {
  const sidebar = (
    <aside style={{
      width: 220, flexShrink: 0, background: '#fff', borderRight: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid #f3f4f6' }}>
        <Link href="/my" style={{ fontSize: 11, color: '#9ca3af', textDecoration: 'none' }}>← 내 사이트 목록</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: '#111827', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
          }}>
            {site?.name?.charAt(0) || '?'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {site?.name}
            </div>
            <div style={{ fontSize: 10, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sitePublicHostname(site?.subdomain)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 10px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, marginBottom: 6, paddingLeft: 8 }}>
          바로가기
        </div>
        <Link
          href={siteAdminPath(siteCode, '/editor')}
          style={quickLinkStyle}
          onClick={() => onMobileOpen?.(false)}
        >
          🎨 디자인 모드
        </Link>
        <a
          href={sitePublicPath(siteCode)}
          target="_blank"
          rel="noreferrer"
          style={quickLinkStyle}
        >
          🖥 사이트 바로가기
        </a>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, marginBottom: 6, paddingLeft: 8 }}>
          사이트 관리
        </div>
        {SITE_ADMIN_NAV.map(group => {
          const open = openGroups[group.key]
          const childActive = group.children.some(c => c.key === menuKey)
          return (
            <div key={group.key} style={{ marginBottom: 4 }}>
              <button
                type="button"
                onClick={() => onToggleGroup(group.key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 10px', border: 'none', borderRadius: 8, cursor: 'pointer',
                  background: childActive ? '#f3f4f6' : 'transparent',
                  color: '#111827', fontSize: 13, fontWeight: 600, textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 14 }}>{group.icon}</span>
                <span style={{ flex: 1 }}>{group.label}</span>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>{open ? '▾' : '▸'}</span>
              </button>
              {open && (
                <div style={{ padding: '2px 0 6px 12px' }}>
                  {group.children.map(child => {
                    const active = menuKey === child.key
                    const showBadge = child.key === 'comm.status' && pendingTicketCount > 0
                    return (
                      <button
                        key={child.key}
                        type="button"
                        onClick={() => {
                          onMenuChange(child.key)
                          onMobileOpen?.(false)
                        }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 10px', border: 'none', borderRadius: 7, cursor: 'pointer',
                          background: active ? '#111827' : 'transparent',
                          color: active ? '#fff' : '#4b5563',
                          fontSize: 12.5, fontWeight: active ? 600 : 500, textAlign: 'left',
                          position: 'relative',
                        }}
                      >
                        <span style={{ flex: 1 }}>{child.label}</span>
                        {showBadge && (
                          <span style={{
                            background: active ? '#fff' : '#ef4444',
                            color: active ? '#ef4444' : '#fff',
                            borderRadius: 999, fontSize: 10, fontWeight: 700,
                            minWidth: 16, height: 16, display: 'inline-flex',
                            alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                          }}>
                            {pendingTicketCount}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {(customer?.name || customer?.email) && (
        <div style={{
          marginTop: 'auto', padding: '12px 14px', borderTop: '1px solid #f3f4f6',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
            {customer?.name || '회원'}님
          </div>
          {customer?.email && (
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, wordBreak: 'break-all' }}>
              {customer.email}
            </div>
          )}
        </div>
      )}
    </aside>
  )

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f7f4',
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      {/* 상단 바 */}
      <header style={{
        height: 52, flexShrink: 0, background: '#fff', borderBottom: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', gap: 12, position: 'sticky', top: 0, zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => onMobileOpen?.(!mobileOpen)}
            className="lg:hidden"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, border: '1px solid #e5e7eb', borderRadius: 8,
              background: '#fff', cursor: 'pointer', fontSize: 16,
            }}
            aria-label="메뉴"
          >
            ☰
          </button>
          <div className="hidden sm:block" style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
            {findNavLabel(menuKey)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <AuthUserBar variant="light" />
          <a
            href={sitePublicPath(siteCode)}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-block"
            style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none', padding: '5px 10px', border: '1px solid #e5e7eb', borderRadius: 6 }}
          >
            사이트 보기 →
          </a>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
            background: site?.status === 'published' ? '#dcfce7' : '#fef3c7',
            color: site?.status === 'published' ? '#16a34a' : '#d97706',
          }}>
            ● {codeLabel('SITE_STATUS', site?.status)}
          </span>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        {/* 데스크톱 사이드바 */}
        <div className="hidden lg:flex" style={{ position: 'sticky', top: 52, height: 'calc(100vh - 52px)' }}>
          {sidebar}
        </div>

        {/* 모바일 오버레이 */}
        {mobileOpen && (
          <div
            className="lg:hidden"
            style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}
          >
            <div
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }}
              onClick={() => onMobileOpen?.(false)}
            />
            <div style={{ position: 'relative', height: '100%', boxShadow: '4px 0 24px rgba(0,0,0,0.12)' }}>
              {sidebar}
            </div>
          </div>
        )}

        <main style={{ flex: 1, minWidth: 0, padding: '20px 16px 40px', overflowY: 'auto' }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <h1 className="sm:hidden" style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: '#111827' }}>
              {findNavLabel(menuKey)}
            </h1>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

const quickLinkStyle = {
  display: 'block', width: '100%', padding: '8px 10px', borderRadius: 7,
  fontSize: 12.5, fontWeight: 500, color: '#374151', textDecoration: 'none',
  boxSizing: 'border-box',
}
