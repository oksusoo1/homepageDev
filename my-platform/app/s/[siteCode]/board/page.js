import Link from 'next/link'
import { notFound } from 'next/navigation'
import SiteHeader from '@/components/SiteHeader'
import ReviewSiteGate from '@/components/ReviewSiteGate'
import { getPublicSite } from '@/lib/site-public'
import { sitePublicPath } from '@/lib/site-paths'
import { supabase } from '@/lib/supabase'
import { onlyActive } from '@/lib/use-flag'

async function getPosts(siteId) {
  const { data } = await onlyActive(
    supabase
      .from('user_posts')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
  )
  return data || []
}

export default async function BoardListPage({ params }) {
  const { siteCode } = await params
  const site = await getPublicSite(siteCode)
  if (!site) notFound()

  const posts = await getPosts(site.site_id)

  const body = (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: "'Georgia', serif" }}>
      <SiteHeader siteName={site.name} siteCode={siteCode} activePage="board" />

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h2 style={{ margin: '0 0 6px', fontSize: 28, color: '#1c1917' }}>게시판</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#a8a29e' }}>총 {posts.length}개의 글</p>
          </div>
          <Link href={sitePublicPath(siteCode, '/board/write')} style={{
            padding: '12px 24px', background: '#1c1917', color: 'white',
            borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600,
          }}>
            글쓰기
          </Link>
        </div>

        {posts.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 40px', background: 'white',
            borderRadius: 12, border: '1px solid #e7e5e4', color: '#a8a29e',
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
            <div>아직 작성된 글이 없습니다</div>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e7e5e4', overflow: 'hidden' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 120px 120px',
              padding: '12px 24px', background: '#f5f5f4',
              borderBottom: '1px solid #e7e5e4',
              fontSize: 11, color: '#a8a29e', letterSpacing: 1, textTransform: 'uppercase',
            }}>
              <span>제목</span>
              <span style={{ textAlign: 'center' }}>작성자</span>
              <span style={{ textAlign: 'right' }}>날짜</span>
            </div>
            {posts.map((post, i) => (
              <Link key={post.post_id}
                href={sitePublicPath(siteCode, `/board/${post.post_id}`)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 120px 120px',
                  padding: '18px 24px', textDecoration: 'none', color: '#1c1917',
                  borderBottom: i < posts.length - 1 ? '1px solid #f5f5f4' : 'none',
                }}>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{post.title}</span>
                <span style={{ fontSize: 13, color: '#78716c', textAlign: 'center' }}>{post.author}</span>
                <span style={{ fontSize: 12, color: '#a8a29e', textAlign: 'right' }}>
                  {new Date(post.created_at).toLocaleDateString('ko-KR')}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <footer style={{ background: '#1c1917', color: '#78716c', textAlign: 'center', padding: '24px', fontSize: 12 }}>
        © {new Date().getFullYear()} {site.name} · Powered by MyPlatform
      </footer>
    </div>
  )

  if (site.status === 'review' || site.status === 'draft') {
    return (
      <ReviewSiteGate site={site} siteCode={siteCode}>
        {body}
      </ReviewSiteGate>
    )
  }

  return body
}
