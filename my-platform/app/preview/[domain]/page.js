import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

async function getSite(domain) {
  const subdomain = domain.split('.')[0]

  // 커스텀 도메인 먼저 조회 (cancelled만 제외)
  let { data } = await supabase
    .from('sites')
    .select('*')
    .eq('domain', domain)
    .neq('status', 'cancelled')
    .single()
  if (data) return data

  // 서브도메인으로 조회
  ;({ data } = await supabase
    .from('sites')
    .select('*')
    .eq('subdomain', subdomain)
    .neq('status', 'cancelled')
    .single())
  return data
}

async function getRecentPosts(siteId) {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(3)
  return data || []
}

export default async function CustomerSitePage({ params }) {
  const { domain } = await params
  const site = await getSite(domain)
  if (!site) notFound()

  // 정지된 사이트 안내 페이지
  if (site.status === 'suspended') {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f7f4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>🔒</div>
          <h1 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 800, color: '#111827' }}>사이트 준비 중입니다</h1>
          <p style={{ margin: '0 0 8px', fontSize: 15, color: '#6b7280', lineHeight: 1.8 }}>
            현재 이 사이트는 일시적으로 운영이 중단되었습니다.<br />
            사이트 운영자에게 문의해 주세요.
          </p>
          <p style={{ margin: '24px 0 0', fontSize: 12, color: '#9ca3af' }}>Powered by MyPlatform</p>
        </div>
      </div>
    )
  }

  const posts = await getRecentPosts(site.site_id)

  const c = site.content || {}
  const hero = { title: '', subtitle: '', ctaText: '문의하기', bgColor: '#1c1917', ...c.hero }
  const sections = { showInfo: true, showBoard: true, ...c.sections }

  const heroBg = hero.bgColor || '#1c1917'
  const heroTitle = hero.title || site.name
  const heroSubtitle = hero.subtitle || site.description
  const ctaText = hero.ctaText || '문의하기'

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: "'Georgia', serif" }}>

      {/* 헤더 */}
      <header style={{
        background: heroBg, color: 'white',
        padding: '0 40px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.5px' }}>
          {site.name}
        </h1>
        <nav style={{ display: 'flex', gap: 28 }}>
          {[
            { label: '홈',    href: `/preview/${domain}` },
            { label: '게시판', href: `/preview/${domain}/board` },
            { label: '문의',   href: `/preview/${domain}/contact` },
          ].map(({ label, href }) => (
            <Link key={label} href={href}
              style={{ color: '#d6d3d1', textDecoration: 'none', fontSize: 14 }}>
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {/* 히어로 */}
      <section style={{
        background: `linear-gradient(135deg, ${heroBg} 0%, #292524 60%, #44403c 100%)`,
        color: 'white', padding: '100px 40px', textAlign: 'center',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <p style={{ fontSize: 11, letterSpacing: 4, color: '#a8a29e', marginBottom: 20, textTransform: 'uppercase' }}>
            Welcome
          </p>
          <h2 style={{ fontSize: 44, fontWeight: 700, margin: '0 0 24px', lineHeight: 1.2 }}>
            {heroTitle}
          </h2>
          {heroSubtitle && (
            <p style={{ fontSize: 16, color: '#d6d3d1', lineHeight: 1.9, margin: '0 0 36px' }}>
              {heroSubtitle}
            </p>
          )}
          <Link href={`/preview/${domain}/contact`} style={{
            display: 'inline-block', padding: '14px 32px',
            background: 'white', color: '#1c1917',
            borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600,
          }}>
            {ctaText}
          </Link>
        </div>
      </section>

      {/* 정보 카드 */}
      {sections.showInfo && (
        <section style={{ maxWidth: 800, margin: '60px auto', padding: '0 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              { icon: '📍', label: '주소',   value: site.address },
              { icon: '📞', label: '전화',   value: site.phone },
              { icon: '✉️', label: '이메일', value: site.email },
            ].map(({ icon, label, value }) => value && (
              <div key={label} style={{
                background: 'white', borderRadius: 12, padding: '28px 20px',
                textAlign: 'center', border: '1px solid #e7e5e4',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
                <div style={{ fontSize: 11, color: '#a8a29e', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>
                  {label}
                </div>
                <div style={{ fontSize: 14, color: '#1c1917', fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 최근 게시글 */}
      {sections.showBoard && posts.length > 0 && (
        <section style={{ maxWidth: 800, margin: '0 auto 80px', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3 style={{ margin: 0, fontSize: 22, color: '#1c1917' }}>최근 공지</h3>
            <Link href={`/preview/${domain}/board`}
              style={{ fontSize: 13, color: '#78716c', textDecoration: 'none' }}>
              전체보기 →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {posts.map((post, i) => (
              <Link key={post.post_id} href={`/preview/${domain}/board/${post.post_id}`} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '20px 24px', background: 'white', textDecoration: 'none', color: '#1c1917',
                borderRadius: i === 0 ? '12px 12px 0 0' : i === posts.length - 1 ? '0 0 12px 12px' : 0,
                border: '1px solid #e7e5e4',
                borderTop: i > 0 ? 'none' : '1px solid #e7e5e4',
              }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{post.title}</div>
                  <div style={{ fontSize: 12, color: '#a8a29e' }}>{post.author}</div>
                </div>
                <div style={{ fontSize: 12, color: '#a8a29e' }}>
                  {new Date(post.created_at).toLocaleDateString('ko-KR')}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 푸터 */}
      <footer style={{ background: heroBg, color: '#78716c', textAlign: 'center', padding: '32px', fontSize: 12 }}>
        <p style={{ margin: '0 0 6px' }}>© {new Date().getFullYear()} {site.name}</p>
        <p style={{ margin: 0, fontSize: 11 }}>Powered by MyPlatform</p>
      </footer>
    </div>
  )
}
