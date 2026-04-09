import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

async function getSite(domain) {
  const subdomain = domain.split('.')[0]
  const { data } = await supabase
    .from('sites')
    .select('*')
    .or(`domain.eq.${domain},subdomain.eq.${subdomain}`)
    .single()
  return data
}

async function getPost(postId) {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('post_id', postId)   // ← post_id (PK)
    .single()
  return data
}

export default async function PostDetailPage({ params }) {
  const { domain, post_id } = await params
  const site = await getSite(domain)
  if (!site) notFound()

  const post = await getPost(post_id)
  if (!post) notFound()

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: "'Georgia', serif" }}>

      <header style={{
        background: '#1c1917', color: 'white', padding: '0 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64,
      }}>
        <Link href={`/preview/${domain}`} style={{ color: 'white', textDecoration: 'none', fontSize: 20, fontWeight: 600 }}>
          {site.name}
        </Link>
        <nav style={{ display: 'flex', gap: 28 }}>
          <Link href={`/preview/${domain}`} style={{ color: '#d6d3d1', textDecoration: 'none', fontSize: 14 }}>홈</Link>
          <Link href={`/preview/${domain}/board`} style={{ color: '#d6d3d1', textDecoration: 'none', fontSize: 14 }}>게시판</Link>
          <Link href={`/preview/${domain}/contact`} style={{ color: '#d6d3d1', textDecoration: 'none', fontSize: 14 }}>문의</Link>
        </nav>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px' }}>
        <Link href={`/preview/${domain}/board`} style={{
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
          <Link href={`/preview/${domain}/board`} style={{
            padding: '12px 24px', background: '#f5f5f4', color: '#1c1917',
            borderRadius: 8, textDecoration: 'none', fontSize: 14,
          }}>
            목록
          </Link>
          <Link href={`/preview/${domain}/board/write`} style={{
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
}
