'use client'

import { useState, useEffect } from 'react'
import { boardPath } from '@/lib/site-paths'
import { boardMeta, isUnanswered } from '@/lib/user-board'
import {
  createOwnerPostAction,
  deleteOwnerPostAction,
  addOwnerCommentAction,
  deleteOwnerCommentAction,
} from '@/app/s/[siteCode]/admin/actions'

/**
 * 사장님 관리자 — 게시물 관리 (모든 게시판 통합 목록)
 * - 필터: 게시판 · 답변 대기만 · 검색
 * - 행 클릭 → 본문 · 연락처 · 댓글 · 답변 작성
 * 데이터(boards, posts)는 상위(admin page)가 소유 → 뱃지·알림과 공유
 */
export default function UserPostsManager({ site, ownerName, boards, posts, focusPostId, onReload }) {
  const [boardFilter, setBoardFilter] = useState('all')
  const [onlyUnanswered, setOnlyUnanswered] = useState(false)
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState(focusPostId || null)
  const [reply, setReply] = useState('')
  const [writing, setWriting] = useState(false)
  const [draft, setDraft] = useState({ boardId: '', title: '', content: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!focusPostId) return
    setOpenId(focusPostId)
    setTimeout(() => document.getElementById('post-' + focusPostId)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }, [focusPostId])

  const boardById = Object.fromEntries(boards.map(b => [b.user_board_id, b]))
  const q = query.trim().toLowerCase()
  const list = posts.filter(p => {
    if (boardFilter !== 'all' && p.user_board_id !== boardFilter) return false
    if (onlyUnanswered && !isUnanswered(p, boardById[p.user_board_id])) return false
    if (q && !`${p.title} ${p.content} ${p.author}`.toLowerCase().includes(q)) return false
    return true
  })
  const unansweredCount = posts.filter(p => isUnanswered(p, boardById[p.user_board_id])).length

  async function run(fn, okMsg) {
    setBusy(true); setMsg('')
    try {
      await fn()
      await onReload()
      if (okMsg) setMsg(okMsg)
    } catch (e) {
      setMsg('❌ ' + (e.message || e))
    }
    setBusy(false)
  }

  const addReply = (post) => run(async () => {
    const text = reply.trim()
    if (!text) throw new Error('답변 내용을 입력해 주세요')
    const res = await addOwnerCommentAction(site.subdomain, post.post_id, text)
    if (!res.ok) throw new Error(res.error)
    setReply('')
  }, '✅ 답변을 등록했습니다')

  const deleteComment = (c) => {
    if (!window.confirm('이 댓글을 삭제할까요?')) return
    run(async () => {
      const res = await deleteOwnerCommentAction(site.subdomain, c.user_comment_id)
      if (!res.ok) throw new Error(res.error)
    }, '댓글을 삭제했습니다')
  }

  const deletePost = (post) => {
    if (!window.confirm('이 글을 삭제할까요?')) return
    run(async () => {
      const res = await deleteOwnerPostAction(site.subdomain, post.post_id)
      if (!res.ok) throw new Error(res.error)
      setOpenId(null)
    }, '글을 삭제했습니다')
  }

  const submitPost = (e) => {
    e.preventDefault()
    run(async () => {
      const boardId = draft.boardId || boards[0]?.user_board_id
      if (!boardId) throw new Error('게시판이 없습니다')
      const res = await createOwnerPostAction(site.subdomain, {
        boardId, title: draft.title, content: draft.content,
      })
      if (!res.ok) throw new Error(res.error)
      setDraft({ boardId: '', title: '', content: '' })
      setWriting(false)
    }, '✅ 글을 등록했습니다')
  }

  const card = { background: 'white', borderRadius: 14, border: '1px solid #e5e7eb' }
  const input = { width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white' }
  const btn = (primary = true) => ({
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: primary ? 'none' : '1px solid #e5e7eb', background: primary ? '#111827' : 'white', color: primary ? 'white' : '#374151',
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#111827' }}>게시물 관리</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            모든 게시판의 글을 한곳에서 봅니다{unansweredCount ? ` · 답변 대기 ${unansweredCount}건` : ''}
          </p>
        </div>
        {!writing && <button type="button" onClick={() => setWriting(true)} style={{ ...btn(), whiteSpace: 'nowrap' }}>+ 글쓰기</button>}
      </div>

      {msg && <p style={{ fontSize: 13, color: msg.startsWith('❌') ? '#ef4444' : '#15803d', margin: '0 0 12px' }}>{msg}</p>}

      {writing && (
        <form onSubmit={submitPost} style={{ ...card, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <select value={draft.boardId || boards[0]?.user_board_id || ''} onChange={e => setDraft({ ...draft, boardId: e.target.value })}
              style={{ ...input, width: 'auto' }}>
              {boards.map(b => <option key={b.user_board_id} value={b.user_board_id}>{b.name}</option>)}
            </select>
            <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}
              placeholder="제목" required style={{ ...input, flex: 1, minWidth: 180 }} />
          </div>
          <textarea value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })}
            placeholder="내용" required rows={5} style={{ ...input, resize: 'vertical', marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={busy} style={btn()}>등록</button>
            <button type="button" onClick={() => setWriting(false)} style={btn(false)}>취소</button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={boardFilter} onChange={e => setBoardFilter(e.target.value)} style={{ ...input, width: 'auto' }}>
          <option value="all">전체 게시판</option>
          {boards.map(b => <option key={b.user_board_id} value={b.user_board_id}>{b.name}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyUnanswered} onChange={e => setOnlyUnanswered(e.target.checked)} />
          답변 대기만
        </label>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="제목·내용·작성자 검색"
          style={{ ...input, flex: 1, minWidth: 160 }} />
      </div>

      {list.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          {posts.length ? '조건에 맞는 글이 없습니다' : '아직 작성된 글이 없습니다'}
        </div>
      ) : (
        <div style={{ ...card, overflow: 'hidden' }}>
          {list.map((p, i) => {
            const board = boardById[p.user_board_id]
            const waiting = isUnanswered(p, board)
            const open = openId === p.post_id
            return (
              <div key={p.post_id} id={'post-' + p.post_id}
                style={{ borderBottom: i < list.length - 1 ? '1px solid #f3f4f6' : 'none', background: open ? '#fafafa' : 'white' }}>
                <button type="button" onClick={() => { setOpenId(open ? null : p.post_id); setReply(''); setMsg('') }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                    {board?.name || '—'}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.is_private && '🔒 '}{p.title}
                  </span>
                  {waiting && <span style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', background: '#fee2e2', padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>답변 대기</span>}
                  {!waiting && p.user_comments.length > 0 && <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>댓글 {p.user_comments.length}</span>}
                  <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{p.author_type === 'owner' ? '사장님' : p.author}</span>
                  <span className="hidden sm:inline" style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                    {new Date(p.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </button>

                {open && (
                  <div style={{ padding: '0 18px 18px' }}>
                    <p style={{ margin: '0 0 10px', fontSize: 14, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{p.content}</p>
                    {p.author_type === 'user' && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                        {p.phone && <span style={{ marginRight: 12 }}>📞 {p.phone}</span>}
                        {p.email && <span style={{ marginRight: 12 }}>✉️ {p.email}</span>}
                        {!p.phone && !p.email && <span>연락처 없음</span>}
                      </div>
                    )}

                    {p.user_comments.map(c => (
                      <div key={c.user_comment_id} style={{ padding: '10px 12px', background: 'white', border: '1px solid #e5e7eb', borderLeft: c.author_type === 'owner' ? '3px solid #111827' : '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                          <span><b>{c.author_type === 'owner' ? '내 답변' : c.author}</b> · {new Date(c.created_at).toLocaleString('ko-KR')}</span>
                          <button type="button" onClick={() => deleteComment(c)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 11 }}>삭제</button>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: '#111827', whiteSpace: 'pre-wrap' }}>{c.content}</p>
                      </div>
                    ))}

                    <textarea value={reply} onChange={e => setReply(e.target.value)} rows={3}
                      placeholder={boardMeta(board).needsReply ? '답변을 입력하세요' : '댓글을 입력하세요'}
                      style={{ ...input, resize: 'vertical', margin: '4px 0 10px' }} />
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button type="button" disabled={busy} onClick={() => addReply(p)} style={{ ...btn(), opacity: busy ? 0.6 : 1 }}>
                        {boardMeta(board).needsReply ? '답변 등록' : '댓글 등록'}
                      </button>
                      {board && (
                        <a href={boardPath(site.subdomain, board.board_key, p.post_id)} target="_blank" rel="noreferrer"
                          style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none' }}>사이트에서 보기 ↗</a>
                      )}
                      <button type="button" onClick={() => deletePost(p)}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>글 삭제</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
