'use client'

import { usePathname } from 'next/navigation'

/**
 * 방문자용 공개 범위 리본
 * published(공개) → 표시 없음
 */

const RIBBON = {
  producer: {
    label: '제작 중',
    hint: '제작자만',
    bg: '#64748b',
    fg: '#ffffff',
  },
  partial: {
    label: '부분공개',
    hint: '본사·회원만',
    bg: '#f59e0b',
    fg: '#1c1917',
  },
  hidden: {
    label: '미공개',
    hint: '이용 중단',
    bg: '#dc2626',
    fg: '#ffffff',
  },
  // status 호환 (구 호출)
  draft: {
    label: '제작 중',
    hint: '제작자만',
    bg: '#64748b',
    fg: '#ffffff',
  },
  review: {
    label: '부분공개',
    hint: '본사·회원만',
    bg: '#f59e0b',
    fg: '#1c1917',
  },
  suspended: {
    label: '미공개',
    hint: '이용 중단',
    bg: '#dc2626',
    fg: '#ffffff',
  },
  cancelled: {
    label: '해지됨',
    hint: '서비스 종료',
    bg: '#57534e',
    fg: '#ffffff',
  },
}

export default function SiteStatusRibbon({ status, visibility, position = 'top-right' }) {
  const key = visibility || status
  const cfg = RIBBON[key]
  if (!cfg) return null

  const isLeft = position === 'top-left'

  return (
    <div
      role="status"
      aria-label={`${cfg.label}. ${cfg.hint}`}
      style={{
        position: 'fixed',
        top: 0,
        ...(isLeft ? { left: 0 } : { right: 0 }),
        width: 140,
        height: 140,
        overflow: 'hidden',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          ...(isLeft ? { left: 0 } : { right: 0 }),
          width: 12,
          height: 12,
          background: 'rgba(0,0,0,0.18)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 32,
          ...(isLeft
            ? { left: -48, transform: 'rotate(-45deg)' }
            : { right: -48, transform: 'rotate(45deg)' }),
          width: 220,
          padding: '10px 0 8px',
          background: cfg.bg,
          color: cfg.fg,
          textAlign: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
          fontFamily: '-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
          borderTop: '1px solid rgba(255,255,255,0.35)',
          borderBottom: '1px solid rgba(0,0,0,0.15)',
        }}
      >
        <div style={{
          fontSize: 14,
          fontWeight: 900,
          letterSpacing: '0.08em',
          lineHeight: 1.15,
        }}>
          {cfg.label}
        </div>
        <div style={{
          marginTop: 2,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.02em',
          opacity: 0.9,
          lineHeight: 1.2,
        }}>
          {cfg.hint}
        </div>
      </div>
    </div>
  )
}

/**
 * /s/[siteCode] layout용 — admin 경로에서는 숨김
 */
export function SiteStatusRibbonHost({ status, visibility }) {
  const pathname = usePathname() || ''
  if (pathname.includes('/admin')) return null
  const key = visibility || status
  if (!key || !RIBBON[key]) return null
  return <SiteStatusRibbon status={status} visibility={visibility} position="top-right" />
}

/** status/visibility에 리본이 필요한지 */
export function needsStatusRibbon(status, visibility) {
  return Boolean(RIBBON[visibility] || RIBBON[status])
}
