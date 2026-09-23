'use client'

import { usePathname } from 'next/navigation'

/**
 * 방문자용 공개 범위 표시 — 우측 하단 작은 배지
 * public → 표시 없음 (일반 공개 사이트에는 아무것도 안 보임)
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
}

export default function SiteStatusRibbon({ status, visibility }) {
  const key = visibility || status
  const cfg = RIBBON[key]
  if (!cfg) return null

  // 화면 우측 하단 작은 표시 — 헤더(로그인·메뉴)를 가리지 않는다
  return (
    <div
      role="status"
      aria-label={`${cfg.label}. ${cfg.hint}`}
      style={{
        position: 'fixed',
        right: 14,
        bottom: 14,
        zIndex: 9999,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderRadius: 999,
        background: cfg.bg,
        color: cfg.fg,
        boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
        fontFamily: '-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.02em',
        maxWidth: 'calc(100vw - 28px)',
      }}
    >
      <span>{cfg.label}</span>
      <span style={{ width: 1, height: 11, background: cfg.fg, opacity: 0.35 }} aria-hidden />
      <span style={{ fontWeight: 600, opacity: 0.9 }}>{cfg.hint}</span>
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
  return <SiteStatusRibbon status={status} visibility={visibility} />
}

/** status/visibility에 리본이 필요한지 */
export function needsStatusRibbon(status, visibility) {
  return Boolean(RIBBON[visibility] || RIBBON[status])
}
