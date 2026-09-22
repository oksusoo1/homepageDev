import SiteHeader from '@/components/SiteHeader'
import SiteVisibilityGate from '@/components/SiteVisibilityGate'

/**
 * 고객(방문자) 사이트 페이지 틀 — 헤더 · 푸터 · 공개범위 게이트
 * visibility: public 이면 그대로, producer/partial 이면 게이트로 감쌈
 */
export default function SitePublicFrame({ site, siteCode, visibility = 'public', activePage = '', maxWidth = 800, children }) {
  const body = (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: "'Georgia', serif", display: 'flex', flexDirection: 'column' }}>
      <SiteHeader siteName={site?.name || siteCode} siteCode={siteCode} activePage={activePage} />
      <div style={{ flex: 1, width: '100%', maxWidth, margin: '0 auto', padding: '48px 20px 80px', boxSizing: 'border-box' }}>
        {children}
      </div>
      <footer style={{ background: '#1c1917', color: '#78716c', textAlign: 'center', padding: '24px', fontSize: 12 }}>
        © {new Date().getFullYear()} {site?.name} · Powered by MyPlatform
      </footer>
    </div>
  )

  if (!site || visibility === 'public') return body

  return (
    <SiteVisibilityGate site={site} siteCode={siteCode} visibility={visibility}>
      {body}
    </SiteVisibilityGate>
  )
}
