'use client'
import { useState, useActionState } from 'react'
import Link from 'next/link'
import { boardPath } from '@/lib/site-paths'
import { boardMeta, WRITE_DENY_COPY } from '@/lib/user-board'
import { createPublicPostAction } from '@/app/s/[siteCode]/actions'

export default function WritePostForm({
  siteCode, board, mode, denyReason, ownerName,
}) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', title: '', content: '', is_private: false })
  const [error, setError] = useState('')
  const [actionState, formAction, saving] = useActionState(createPublicPostAction, null)

  function handleSubmit(e) {
    setError('')
    const meta = boardMeta(board)
    if (mode !== 'owner') {
      if (!form.name.trim()) { e.preventDefault(); return setError('이름을 입력해 주세요') }
      if (meta.needsContact && !form.phone.trim() && !form.email.trim()) {
        e.preventDefault()
        return setError('연락처(전화 또는 이메일)를 하나 이상 입력해 주세요')
      }
    }
  }

  const inputStyle = {
    width: '100%', padding: '12px 16px', border: '1px solid #e7e5e4', borderRadius: 8,
    fontSize: 15, outline: 'none', boxSizing: 'border-box', color: '#1c1917', background: 'white',
  }
  const label = { display: 'block', fontSize: 13, color: '#78716c', marginBottom: 8 }
  const field = (key, text, props = {}) => (
    <div style={{ marginBottom: 18 }}>
      <label style={label}>{text}</label>
      <input name={key} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} style={inputStyle} {...props} />
    </div>
  )

  const listHref = board ? boardPath(siteCode, board.board_key) : `/s/${siteCode}`

  if (mode === 'deny') {
    const copy = board && boardMeta(board).userCanWrite
      ? (WRITE_DENY_COPY[denyReason] || WRITE_DENY_COPY.login)
      : { title: '운영자만 작성할 수 있습니다', body: '이 게시판은 사이트 운영자가 작성하는 공지 게시판입니다.' }
    return (
      <div style={{ textAlign: 'center', paddingTop: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ margin: '0 0 12px', fontSize: 22, color: '#1c1917' }}>{copy.title}</h2>
        <p style={{ margin: '0 0 32px', fontSize: 14, color: '#78716c', lineHeight: 1.7 }}>{copy.body}</p>
        <Link href={listHref} style={{ padding: '12px 24px', background: '#f5f5f4', color: '#1c1917', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}>
          목록으로
        </Link>
      </div>
    )
  }

  const meta = boardMeta(board)

  return (
    <>
      <Link href={listHref} style={{ fontSize: 13, color: '#78716c', textDecoration: 'none', display: 'inline-block', marginBottom: 32 }}>
        ← {board.name}
      </Link>
      <h2 style={{ margin: '0 0 8px', fontSize: 26, color: '#1c1917' }}>{meta.needsReply ? '문의하기' : '글쓰기'}</h2>
      <p style={{ margin: '0 0 32px', fontSize: 13, color: '#78716c' }}>
        {mode === 'owner'
          ? `운영자(${ownerName || '사장님'})로 작성합니다`
          : meta.needsReply ? '운영자가 확인 후 답변합니다. 연락처는 공개되지 않습니다.' : '연락처는 공개되지 않습니다.'}
      </p>

      <form action={formAction} onSubmit={handleSubmit} style={{ background: 'white', borderRadius: 12, border: '1px solid #e7e5e4', padding: 32 }}>
        <input type="hidden" name="siteCode" value={siteCode} />
        <input type="hidden" name="boardKey" value={board.board_key} />
        {mode === 'user' && (
          <>
            {field('name', '이름 *', { placeholder: '홍길동', required: true, 'data-testid': 'board-author' })}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field('phone', meta.needsContact ? '전화' : '전화 (선택)', { placeholder: '010-0000-0000', 'data-testid': 'board-phone' })}
              {field('email', meta.needsContact ? '이메일' : '이메일 (선택)', { type: 'email', placeholder: 'you@example.com' })}
            </div>
          </>
        )}
        {field('title', '제목 *', { placeholder: '제목을 입력하세요', required: true, 'data-testid': 'board-title' })}
        <div style={{ marginBottom: 20 }}>
          <label style={label}>내용 *</label>
          <textarea name="content" data-testid="board-content" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
            placeholder="내용을 입력하세요" required rows={8} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {mode === 'user' && meta.allowPrivate && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 24, fontSize: 14, color: '#44403c', cursor: 'pointer' }}>
            <input type="checkbox" name="isPrivate" data-testid="board-private" checked={form.is_private}
              onChange={e => setForm({ ...form, is_private: e.target.checked })} style={{ marginTop: 3 }} />
            <span>
              <strong>비밀글로 남기기</strong>
              <span style={{ display: 'block', fontSize: 12, color: '#78716c', marginTop: 2 }}>목록에 내용이 보이지 않고, 운영자만 확인할 수 있습니다</span>
            </span>
          </label>
        )}

        {(error || actionState?.error) && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error || actionState.error}</p>}

        <div style={{ display: 'flex', gap: 12 }}>
          <Link href={listHref} style={{ padding: '13px 24px', background: '#f5f5f4', color: '#1c1917', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}>
            취소
          </Link>
          <button type="submit" data-testid="board-submit" disabled={saving} style={{
            flex: 1, padding: 13, background: '#1c1917', color: 'white', border: 'none', borderRadius: 8,
            fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1,
          }}>
            {saving ? '저장 중...' : '등록'}
          </button>
        </div>
      </form>
    </>
  )
}
