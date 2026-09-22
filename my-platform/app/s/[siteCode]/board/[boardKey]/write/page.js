'use client'
import { useState, useEffect } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { onlyActive } from '@/lib/use-flag'
import { boardPath } from '@/lib/site-paths'
import { checkSiteOwnerWriteAccess, WRITE_DENY_COPY } from '@/lib/site-owner-auth'
import { boardMeta } from '@/lib/user-board'
import SitePublicFrame from '@/components/SitePublicFrame'

/**
 * 게시글 작성
 * - 사장님(사이트 소유 customers): 모든 게시판 · author_type owner
 * - 고객(방문자): 공지 제외 · 이름 필수 · 문의는 연락처 필수 + 비밀글 선택
 * - 본사(staff): 작성 불가
 */
export default function WritePostPage({ params }) {
  const { siteCode, boardKey } = use(params)
  const router = useRouter()
  const [site, setSite] = useState(null)
  const [board, setBoard] = useState(null)
  const [mode, setMode] = useState(null) // 'owner' | 'user' | 'deny'
  const [denyReason, setDenyReason] = useState('login')
  const [owner, setOwner] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '', title: '', content: '', is_private: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [siteCode, boardKey])

  async function load() {
    const { data: siteData } = await onlyActive(
      supabase.from('sites').select('site_id, customer_id, name').eq('subdomain', siteCode)
    ).maybeSingle()
    if (!siteData) { setMode('deny'); return }
    setSite(siteData)

    const { data: boardData } = await onlyActive(
      supabase.from('user_boards').select('*').eq('site_id', siteData.site_id).eq('board_key', boardKey)
    ).maybeSingle()
    if (!boardData) { setMode('deny'); return }
    setBoard(boardData)

    const access = await checkSiteOwnerWriteAccess(siteData.customer_id)
    if (access.ok) {
      setOwner(access.customer)
      setMode('owner')
    } else if (access.reason !== 'staff' && boardMeta(boardData).userCanWrite) {
      setMode('user')
    } else {
      setDenyReason(access.reason)
      setMode('deny')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const meta = boardMeta(board)
    const isOwner = mode === 'owner'

    if (!isOwner) {
      if (!form.name.trim()) return setError('이름을 입력해 주세요')
      if (meta.needsContact && !form.phone.trim() && !form.email.trim()) {
        return setError('연락처(전화 또는 이메일)를 하나 이상 입력해 주세요')
      }
    }

    setSaving(true)
    const { error: err } = await supabase.from('user_posts').insert([{
      site_id: site.site_id,
      user_board_id: board.user_board_id,
      title: form.title.trim(),
      content: form.content.trim(),
      author: isOwner ? (owner?.name || '운영자') : form.name.trim(),
      author_type: isOwner ? 'owner' : 'user',
      is_private: !isOwner && meta.allowPrivate && form.is_private,
      phone: isOwner ? null : (form.phone.trim() || null),
      email: isOwner ? null : (form.email.trim() || null),
    }])
    if (err) {
      setError('저장 중 오류: ' + err.message)
      setSaving(false)
      return
    }
    router.push(boardPath(siteCode, board.board_key))
    router.refresh()
  }

  const inputStyle = {
    width: '100%', padding: '12px 16px', border: '1px solid #e7e5e4', borderRadius: 8,
    fontSize: 15, outline: 'none', boxSizing: 'border-box', color: '#1c1917', background: 'white',
  }
  const label = { display: 'block', fontSize: 13, color: '#78716c', marginBottom: 8 }
  const field = (key, text, props = {}) => (
    <div style={{ marginBottom: 18 }}>
      <label style={label}>{text}</label>
      <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} style={inputStyle} {...props} />
    </div>
  )

  if (mode === null) {
    return (
      <div style={{ minHeight: '100vh', background: '#fafaf9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#a8a29e', fontSize: 14 }}>확인 중...</div>
      </div>
    )
  }

  const listHref = board ? boardPath(siteCode, board.board_key) : `/s/${siteCode}`

  if (mode === 'deny') {
    const copy = board && boardMeta(board).userCanWrite
      ? (WRITE_DENY_COPY[denyReason] || WRITE_DENY_COPY.login)
      : { title: '운영자만 작성할 수 있습니다', body: '이 게시판은 사이트 운영자가 작성하는 공지 게시판입니다.' }
    return (
      <SitePublicFrame site={site} siteCode={siteCode} activePage={boardKey} maxWidth={480}>
        <div style={{ textAlign: 'center', paddingTop: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ margin: '0 0 12px', fontSize: 22, color: '#1c1917' }}>{copy.title}</h2>
          <p style={{ margin: '0 0 32px', fontSize: 14, color: '#78716c', lineHeight: 1.7 }}>{copy.body}</p>
          <Link href={listHref} style={{ padding: '12px 24px', background: '#f5f5f4', color: '#1c1917', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}>
            목록으로
          </Link>
        </div>
      </SitePublicFrame>
    )
  }

  const meta = boardMeta(board)

  return (
    <SitePublicFrame site={site} siteCode={siteCode} activePage={board.board_key} maxWidth={720}>
      <Link href={listHref} style={{ fontSize: 13, color: '#78716c', textDecoration: 'none', display: 'inline-block', marginBottom: 32 }}>
        ← {board.name}
      </Link>
      <h2 style={{ margin: '0 0 8px', fontSize: 26, color: '#1c1917' }}>{meta.needsReply ? '문의하기' : '글쓰기'}</h2>
      <p style={{ margin: '0 0 32px', fontSize: 13, color: '#78716c' }}>
        {mode === 'owner'
          ? `운영자(${owner?.name || '사장님'})로 작성합니다`
          : meta.needsReply ? '운영자가 확인 후 답변합니다. 연락처는 공개되지 않습니다.' : '연락처는 공개되지 않습니다.'}
      </p>

      <form onSubmit={handleSubmit} style={{ background: 'white', borderRadius: 12, border: '1px solid #e7e5e4', padding: 32 }}>
        {mode === 'user' && (
          <>
            {field('name', '이름 *', { placeholder: '홍길동', required: true })}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field('phone', meta.needsContact ? '전화' : '전화 (선택)', { placeholder: '010-0000-0000' })}
              {field('email', meta.needsContact ? '이메일' : '이메일 (선택)', { type: 'email', placeholder: 'you@example.com' })}
            </div>
          </>
        )}
        {field('title', '제목 *', { placeholder: '제목을 입력하세요', required: true })}
        <div style={{ marginBottom: 20 }}>
          <label style={label}>내용 *</label>
          <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
            placeholder="내용을 입력하세요" required rows={8} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {mode === 'user' && meta.allowPrivate && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 24, fontSize: 14, color: '#44403c', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_private}
              onChange={e => setForm({ ...form, is_private: e.target.checked })} style={{ marginTop: 3 }} />
            <span>
              <strong>비밀글로 남기기</strong>
              <span style={{ display: 'block', fontSize: 12, color: '#78716c', marginTop: 2 }}>목록에 내용이 보이지 않고, 운영자만 확인할 수 있습니다</span>
            </span>
          </label>
        )}

        {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 12 }}>
          <Link href={listHref} style={{ padding: '13px 24px', background: '#f5f5f4', color: '#1c1917', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}>
            취소
          </Link>
          <button type="submit" disabled={saving} style={{
            flex: 1, padding: 13, background: '#1c1917', color: 'white', border: 'none', borderRadius: 8,
            fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1,
          }}>
            {saving ? '저장 중...' : '등록'}
          </button>
        </div>
      </form>
    </SitePublicFrame>
  )
}
