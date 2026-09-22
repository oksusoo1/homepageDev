'use client'

import Link from 'next/link'
import { siteAdminPath, sitePublicPath, sitePublicHostname } from '@/lib/site-paths'
import { codeLabel } from '@/lib/common-codes'
import AuthUserBar from '@/components/AuthUserBar'

/**
 * 사장님 사이트 관리 — left 메뉴 셸 (아임웹식 섹션 > 대메뉴 > 소메뉴)
 * - 대메뉴는 확장용 그룹: 새 기능은 children 에 한 줄 추가
 * - 미구현 메뉴는 넣지 않는다 (빈 메뉴 금지)
 * - badge: badges[badge] 값이 0보다 크면 표시
 */
export const SITE_ADMIN_NAV = [
  {
    section: '사이트 운영',
    items: [
      { key: 'dashboard', label: '대시보드', icon: '📊' },
      {
        key: 'content',
        label: '콘텐츠',
        icon: '📝',
        children: [
          { key: 'content.posts', label: '게시물 관리', badge: 'unanswered' },
          { key: 'content.boards', label: '게시판 관리' },
        ],
      },
    ],
  },
  {
    section: '관리',
    items: [
      {
        key: 'billing',
        label: '결제',
        icon: '💳',
        children: [
          { key: 'billing.sub', label: '구독 · 결제수단' },
          { key: 'billing.history', label: '결제 내역' },
        ],
      },
      {
        key: 'settings',
        label: '설정',
        icon: '⚙️',
        children: [
          { key: 'settings.site', label: '사이트 정보' },
          { key: 'settings.account', label: '계정' },
        ],
      },
    ],
  },
  {
    section: '도움',
    items: [
      {
        key: 'support',
        label: '본사 요청',
        icon: '🛟',
        children: [
          { key: 'support.requests', label: '요청 · 처리현황' },
        ],
      },
    ],
  },
]

const EXTRA_LABELS = { alerts: '알림' }

export function findNavLabel(menuKey) {
  if (EXTRA_LABELS[menuKey]) return EXTRA_LABELS[menuKey]
  for (const sec of SITE_ADMIN_NAV) {
    for (const item of sec.items) {
      if (item.key === menuKey) return item.label
      const hit = item.children?.find(c => c.key === menuKey)
      if (hit) return hit.label
    }
  }
  return ''
}

export function parentKeyOf(menuKey) {
  return menuKey?.split('.')[0] || 'dashboard'
}

function CountBadge({ count, inverted = false }) {
  if (!count) return null
  return (
    <span style={{
      background: inverted ? '#fff' : '#ef4444',
      color: inverted ? '#ef4444' : '#fff',
      borderRadius: 999, fontSize: 10, fontWeight: 700,
      minWidth: 16, height: 16, display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center', padding: '0 4px',
    }}>
      {count}
    </span>
  )
}

export default function SiteAdminShell({
  site,
  siteCode,
  customer = null,
  menuKey,
  onMenuChange,
  openGroups,
  onToggleGroup,
  badges = {},
  alertCount = 0,
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
        <button
          type="button"
          onClick={() => { onMenuChange('alerts'); onMobileOpen?.(false) }}
          style={{
            ...quickLinkStyle, border: 'none', cursor: 'pointer', textAlign: 'left',
            display: 'flex', alignItems: 'center', gap: 8,
            background: menuKey === 'alerts' ? '#111827' : 'transparent',
            color: menuKey === 'alerts' ? '#fff' : '#374151',
          }}
        >
          <span style={{ flex: 1 }}>🔔 알림</span>
          <CountBadge count={alertCount} inverted={menuKey === 'alerts'} />
        </button>
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

      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 12px' }}>
        {SITE_ADMIN_NAV.map(sec => (
          <div key={sec.section} style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, marginBottom: 6, paddingLeft: 8 }}>
              {sec.section}
            </div>
            {sec.items.map(item => {
              const hasChildren = !!item.children?.length
              const open = hasChildren && openGroups[item.key]
              const active = menuKey === item.key
              const childActive = hasChildren && item.children.some(c => c.key === menuKey)
              const groupCount = hasChildren
                ? item.children.reduce((n, c) => n + (c.badge ? (badges[c.badge] || 0) : 0), 0)
                : 0
              return (
                <div key={item.key} style={{ marginBottom: 4 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (hasChildren) { onToggleGroup(item.key); return }
                      onMenuChange(item.key)
                      onMobileOpen?.(false)
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 10px', border: 'none', borderRadius: 8, cursor: 'pointer',
                      background: active ? '#111827' : childActive ? '#f3f4f6' : 'transparent',
                      color: active ? '#fff' : '#111827', fontSize: 13, fontWeight: 600, textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {hasChildren && !open && <CountBadge count={groupCount} />}
                    {hasChildren && <span style={{ fontSize: 10, color: '#9ca3af' }}>{open ? '▾' : '▸'}</span>}
                  </button>
                  {open && (
                    <div style={{ padding: '2px 0 6px 12px' }}>
                      {item.children.map(child => {
                        const childOn = menuKey === child.key
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
                              background: childOn ? '#111827' : 'transparent',
                              color: childOn ? '#fff' : '#4b5563',
                              fontSize: 12.5, fontWeight: childOn ? 600 : 500, textAlign: 'left',
                            }}
                          >
                            <span style={{ flex: 1 }}>{child.label}</span>
                            <CountBadge count={child.badge ? badges[child.badge] : 0} inverted={childOn} />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
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
            background: ['trial', 'subscribed', 'pay_method'].includes(site?.status) ? '#dcfce7' : '#fef3c7',
            color: ['trial', 'subscribed', 'pay_method'].includes(site?.status) ? '#16a34a' : '#d97706',
          }}>
            ● {codeLabel('FLOW_STEP', site?.status)}
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
