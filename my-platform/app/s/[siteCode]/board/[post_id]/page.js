import Link from 'next/link'
import { notFound } from 'next/navigation'
import SiteHeader from '@/components/SiteHeader'
import ReviewSiteGate from '@/components/ReviewSiteGate'
import { getPublicSite } from '@/lib/site-public'
import { sitePublicPath } from '@/lib/site-paths'
import { supabase } from '@/lib/supabase'
import { onlyActive } from '@/lib/use-flag'

async function getPost(postId) {
  const { data } = await onlyActive(
    supabase
      .from('user_posts')
      .select('*')
      .eq('post_id', postId)
  ).single()
  return data
}

export default async function PostDetailPage({ params }) {
  const { siteCode, post_id } = await params
  const site = await getPublicSite(siteCode)
  if (!site) notFound()

  const post = await getPost(post_id)
  if (!post) notFound()

  const body = (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: "'Georgia', serif" }}>
      <SiteHeader siteName={site.name} siteCode={siteCode} activePage="board" />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px' }}>
        <Link href={sitePublicPath(siteCode, '/board')} style={{
          fontSize: 13, color: '#78716c', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 32,
        }}>
          ← 목록으로
        </Link>

        <article style={{ background: 'white', borderRadius: 12, border: '1px solid #e7e5e4', overflow: 'hidden' }}>
          <div style={{ padding: '32px 36px', borderBottom: '1px solid #e7e5e4' }}>
            <h1 style={{ margin: '0 0 16px', fontSize: 26, color: '#1c1917', lineHeight: 1.4, fontWeight: 700 }}>
              {post.title}
            </h1>
            <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#a8a29e' }}>
              <span>✍️ {post.author}</span>
              <span>🕐 {new Date(post.created_at).toLocaleString('ko-KR')}</span>
            </div>
          </div>
          <div style={{ padding: '36px', fontSize: 16, color: '#292524', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
            {post.content}
          </div>
        </article>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
          <Link href={sitePublicPath(siteCode, '/board')} style={{
            padding: '12px 24px', background: '#f5f5f4', color: '#1c1917',
            borderRadius: 8, textDecoration: 'none', fontSize: 14,
          }}>
            목록
          </Link>
          <Link href={sitePublicPath(siteCode, '/board/write')} style={{
            padding: '12px 24px', background: '#1c1917', color: 'white',
            borderRadius: 8, textDecoration: 'none', fontSize: 14,
          }}>
            글쓰기
          </Link>
        </div>
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
