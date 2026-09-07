'use client'
import { useState, useEffect } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { onlyActive } from '@/lib/use-flag'
import Link from 'next/link'
import { checkSiteOwnerWriteAccess, WRITE_DENY_COPY } from '@/lib/site-owner-auth'

/** 레거시 preview 글쓰기 — 소유 고객만 */
export default function WritePostPage({ params }) {
  const { domain } = use(params)
  const router = useRouter()
  const [form, setForm] = useState({ title: '', content: '', author: '' })
  const [loading, setLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [denyReason, setDenyReason] = useState('login')
  const [site, setSite] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { checkOwner() }, [domain])

  async function checkOwner() {
    const subdomain = domain.split('.')[0]
    const { data: siteData } = await onlyActive(
      supabase
        .from('sites')
        .select('site_id, customer_id, name')
        .or(`domain.eq.${domain},subdomain.eq.${subdomain}`)
    ).maybeSingle()

    if (!siteData) {
      setAuthLoading(false)
      return
    }
    setSite(siteData)

    const access = await checkSiteOwnerWriteAccess(siteData.customer_id)
    if (access.ok) {
      setAuthorized(true)
      setForm(prev => ({ ...prev, author: access.customer.name || '운영자' }))
    } else {
      setAuthorized(false)
      setDenyReason(access.reason)
    }
    setAuthLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const access = await checkSiteOwnerWriteAccess(site.customer_id)
    if (!access.ok) {
      setError('소유 고객만 글을 등록할 수 있습니다.')
      setAuthorized(false)
      setDenyReason(access.reason)
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('user_posts')
      .insert([{
        site_id: site.site_id,
        title: form.title,
        content: form.content,
        author: form.author || access.customer.name || '운영자',
      }])

    if (insertError) {
      setError('저장 중 오류: ' + insertError.message)
      setLoading(false)
      return
    }

    router.push(`/preview/${domain}/board`)
    router.refresh()
  }

  const inputStyle = {
    width: '100%', padding: '12px 16px',
    border: '1px solid #e7e5e4', borderRadius: 8,
    fontSize: 15, outline: 'none',
    boxSizing: 'border-box', color: '#1c1917',
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fafaf9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#a8a29e', fontSize: 14 }}>확인 중...</div>
      </div>
    )
  }

  if (!authorized) {
    const copy = WRITE_DENY_COPY[denyReason] || WRITE_DENY_COPY.login
    return (
      <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: "'Georgia', serif" }}>
        <header style={{
          background: '#1c1917', color: 'white', padding: '0 40px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64,
        }}>
          <Link href={`/preview/${domain}`} style={{ color: 'white', textDecoration: 'none', fontSize: 20, fontWeight: 600 }}>
            {site?.name || domain}
          </Link>
        </header>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '80px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ margin: '0 0 12px', fontSize: 22, color: '#1c1917' }}>{copy.title}</h2>
          <p style={{ margin: '0 0 32px', fontSize: 14, color: '#78716c', lineHeight: 1.7 }}>{copy.body}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link href={`/preview/${domain}/board`} style={{
              padding: '12px 24px', background: '#f5f5f4', color: '#1c1917',
              borderRadius: 8, textDecoration: 'none', fontSize: 14,
            }}>목록으로</Link>
            <Link href="/login" style={{
              padding: '12px 24px', background: '#1c1917', color: 'white',
              borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600,
            }}>고객 로그인</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: "'Georgia', serif" }}>
      <header style={{
        background: '#1c1917', color: 'white', padding: '0 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64,
      }}>
        <Link href={`/preview/${domain}`} style={{ color: 'white', textDecoration: 'none', fontSize: 20, fontWeight: 600 }}>
          {site?.name || domain}
        </Link>
      </header>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 26, color: '#1c1917' }}>글쓰기</h2>
        <p style={{ margin: '0 0 32px', fontSize: 13, color: '#78716c' }}>사이트 소유 고객만 작성할 수 있습니다</p>
        <form onSubmit={handleSubmit} style={{
          background: 'white', borderRadius: 12, border: '1px solid #e7e5e4', padding: 36,
        }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#78716c', marginBottom: 8 }}>작성자</label>
            <input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })}
              placeholder="이름" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#78716c', marginBottom: 8 }}>제목 *</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              required style={inputStyle} />
          </div>
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#78716c', marginBottom: 8 }}>내용 *</label>
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
              required rows={8} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: 13, background: '#1c1917', color: 'white',
            border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
            cursor: 'pointer', opacity: loading ? 0.6 : 1,
          }}>
            {loading ? '저장 중...' : '게시글 등록'}
          </button>
        </form>
      </div>
    </div>
  )
}
