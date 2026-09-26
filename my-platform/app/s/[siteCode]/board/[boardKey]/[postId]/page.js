import Link from 'next/link'
import { notFound } from 'next/navigation'
import SitePublicFrame from '@/components/SitePublicFrame'
import SiteGateScreen from '@/components/SiteGateScreen'
import { boardPath } from '@/lib/site-paths'
import { getVisitorAccess } from '@/lib/public/site'
import { loadPublicBoard, loadPublicPost } from '@/lib/public/board'
import { boardMeta, maskName } from '@/lib/user-board'

export const dynamic = 'force-dynamic'

export default async function PostDetailPage({ params }) {
  const { siteCode, boardKey, postId } = await params
  const access = await getVisitorAccess(siteCode)
  if (access.notFound) notFound()
  if (!access.ok) {
    return <SiteGateScreen visibility={access.visibility} siteCode={siteCode} cancelled={access.cancelled} />
  }

  const board = await loadPublicBoard(access.siteId, boardKey)
  if (!board) notFound()
  const meta = boardMeta(board)
  const post = await loadPublicPost(board, postId, access.viewer, access.customerId)
  if (!post) notFound()

  const author = post.author_type === 'owner' ? post.author : maskName(post.author)
  const listHref = boardPath(siteCode, board.board_key)
  const btn = (primary) => ({
    padding: '12px 24px', borderRadius: 8, textDecoration: 'none', fontSize: 14,
    background: primary ? '#1c1917' : '#f5f5f4', color: primary ? 'white' : '#1c1917',
  })

  return (
    <SitePublicFrame site={access.site} siteCode={siteCode} boards={access.boards} activePage={board.board_key} maxWidth={720} authPreset={access.authPreset} isSiteOwner={access.isSiteOwner}>
      <Link href={listHref} style={{ fontSize: 13, color: '#78716c', textDecoration: 'none', display: 'inline-block', marginBottom: 32 }}>
        ← {board.name}
      </Link>

      <article style={{ background: 'white', borderRadius: 12, border: '1px solid #e7e5e4', overflow: 'hidden' }}>
        <div style={{ padding: '32px 36px', borderBottom: '1px solid #e7e5e4' }}>
          <h1 style={{ margin: '0 0 16px', fontSize: 26, color: '#1c1917', lineHeight: 1.4, fontWeight: 700 }}>
            {post.canRead ? post.title : '🔒 비밀글입니다'}
          </h1>
          <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#a8a29e' }}>
            <span>✍️ {author}</span>
            <span>🕐 {new Date(post.created_at).toLocaleString('ko-KR')}</span>
          </div>
        </div>
        <div style={{ padding: '36px', fontSize: 16, color: post.canRead ? '#292524' : '#78716c', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
          {post.canRead ? post.content : '작성자와 운영자만 내용을 확인할 수 있습니다.'}
        </div>
      </article>

      {post.canRead ? (
        post.user_comments.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {post.user_comments.map(c => (
              <div key={c.user_comment_id} style={{
                background: 'white', borderRadius: 12, border: '1px solid #e7e5e4',
                borderLeft: c.author_type === 'owner' ? '3px solid #1c1917' : '1px solid #e7e5e4', padding: '16px 20px',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#78716c', marginBottom: 6 }}>
                  {c.author_type === 'owner' ? '운영자 답변' : maskName(c.author)}
                  <span style={{ fontWeight: 400, marginLeft: 8 }}>{new Date(c.created_at).toLocaleDateString('ko-KR')}</span>
                </div>
                <p style={{ margin: 0, fontSize: 15, color: '#1c1917', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{c.content}</p>
              </div>
            ))}
          </div>
        )
      ) : (
        meta.needsReply && post.answered && (
          <p style={{ margin: '16px 4px 0', fontSize: 13, color: '#a8a29e' }}>✓ 운영자가 답변했습니다 (비공개)</p>
        )
      )}

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <Link href={listHref} style={btn(false)}>목록</Link>
        <Link href={boardPath(siteCode, board.board_key, '/write')} style={btn(true)}>
          {meta.needsReply ? '문의하기' : '글쓰기'}
        </Link>
      </div>
    </SitePublicFrame>
  )
}
