import Link from 'next/link'
import { notFound } from 'next/navigation'
import SitePublicFrame from '@/components/SitePublicFrame'
import SiteGateScreen from '@/components/SiteGateScreen'
import { boardPath } from '@/lib/site-paths'
import { getVisitorAccess } from '@/lib/public/site'
import { loadPublicBoard, loadPublicPosts } from '@/lib/public/board'
import { boardMeta, maskName } from '@/lib/user-board'

export const dynamic = 'force-dynamic'

export default async function BoardListPage({ params, searchParams }) {
  const { siteCode, boardKey } = await params
  const q = await searchParams
  const access = await getVisitorAccess(siteCode)
  if (access.notFound) notFound()
  if (!access.ok) {
    return <SiteGateScreen visibility={access.visibility} siteCode={siteCode} cancelled={access.cancelled} />
  }

  const board = await loadPublicBoard(access.siteId, boardKey)
  if (!board) notFound()
  const meta = boardMeta(board)
  const posts = await loadPublicPosts(board, access.viewer, access.customerId)

  return (
    <SitePublicFrame site={access.site} siteCode={siteCode} boards={access.boards} activePage={board.board_key} authPreset={access.authPreset} isSiteOwner={access.isSiteOwner}>
      {q?.notice === 'secret' && (
        <p data-testid="secret-post-notice" style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
          padding: '14px 16px', marginBottom: 20, fontSize: 13, color: '#92400e', lineHeight: 1.6,
        }}>
          비밀글로 등록되었습니다. 사장님만 볼 수 있어요. 로그인 후 작성하면 나중에 다시 볼 수 있습니다.
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, gap: 16 }}>
        <div>
          <h2 style={{ margin: '0 0 6px', fontSize: 28, color: '#1c1917' }}>{board.name}</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#a8a29e' }}>
            총 {posts.length}개의 글{meta.needsReply ? ' · 남기신 글에 운영자가 답변합니다' : ''}
          </p>
        </div>
        <Link href={boardPath(siteCode, board.board_key, '/write')} style={{
          padding: '12px 24px', background: '#1c1917', color: 'white', whiteSpace: 'nowrap',
          borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600,
        }}>
          {meta.needsReply ? '문의하기' : '글쓰기'}
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
          {posts.map((post, i) => {
            const author = post.author_type === 'owner' ? post.author : maskName(post.author)
            return (
              <Link key={post.post_id}
                href={boardPath(siteCode, board.board_key, post.post_id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '18px 24px', textDecoration: 'none', color: '#1c1917',
                  borderBottom: i < posts.length - 1 ? '1px solid #f5f5f4' : 'none',
                }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {post.canRead ? post.title : '🔒 비밀글입니다'}
                </span>
                {meta.needsReply && post.author_type === 'user' && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
                    background: post.answered ? '#dcfce7' : '#f5f5f4', color: post.answered ? '#15803d' : '#a8a29e',
                  }}>
                    {post.answered ? '답변완료' : '답변대기'}
                  </span>
                )}
                <span style={{ fontSize: 13, color: '#78716c', width: 80, textAlign: 'center', flexShrink: 0 }}>{author}</span>
                <span style={{ fontSize: 12, color: '#a8a29e', width: 80, textAlign: 'right', flexShrink: 0 }}>
                  {new Date(post.created_at).toLocaleDateString('ko-KR')}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </SitePublicFrame>
  )
}
