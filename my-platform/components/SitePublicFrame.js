import SiteHeader from '@/components/SiteHeader'

/**
 * 고객(방문자) 사이트 페이지 틀 — 헤더 · 푸터
 * 공개 범위는 페이지가 서버에서 막은 뒤에만 이 틀을 쓴다.
 */
export default function SitePublicFrame({
  site,
  siteCode,
  boards = [],
  activePage = '',
  maxWidth = 800,
  authPreset = null,
  isSiteOwner = false,
  children,
}) {
  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: "'Georgia', serif", display: 'flex', flexDirection: 'column' }}>
      <SiteHeader
        siteName={site?.name || siteCode}
        siteCode={siteCode}
        boards={boards}
        activePage={activePage}
        authPreset={authPreset}
        isSiteOwner={isSiteOwner}
      />
      <div style={{ flex: 1, width: '100%', maxWidth, margin: '0 auto', padding: '48px 20px 80px', boxSizing: 'border-box' }}>
        {children}
      </div>
      <footer style={{ background: '#1c1917', color: '#78716c', textAlign: 'center', padding: '24px', fontSize: 12 }}>
        © {new Date().getFullYear()} {site?.name} · Powered by MyPlatform
      </footer>
    </div>
  )
}
