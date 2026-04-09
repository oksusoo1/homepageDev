'use client'
import { useState, useEffect } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function WritePostPage({ params }) {
  const { domain } = use(params)
  const router = useRouter()
  const [form, setForm] = useState({ title: '', content: '', author: '' })
  const [loading, setLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [site, setSite] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { checkOwner() }, [domain])

  async function checkOwner() {
    const subdomain = domain.split('.')[0]
    const { data: siteData } = await supabase
      .from('sites')
      .select('site_id, customer_id, name')
      .or(`domain.eq.${domain},subdomain.eq.${subdomain}`)
      .single()

    if (!siteData) { setAuthLoading(false); return }
    setSite(siteData)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAuthLoading(false); return }

    const { data: customer } = await supabase
      .from('customers')
      .select('customer_id')
      .eq('auth_id', user.id)
      .single()

    if (customer && customer.customer_id === siteData.customer_id) {
      setAuthorized(true)
      setForm(prev => ({ ...prev, author: '관리자' }))
    }
    setAuthLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: insertError } = await supabase
      .from('posts')
      .insert([{
        site_id: site.site_id,
        title: form.title,
        content: form.content,
        author: form.author || '관리자',
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

  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#a8a29e', fontSize: 14 }}>확인 중...</div>
    </div>
  )

  if (!authorized) return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: "'Georgia', serif" }}>
      <header style={{
        background: '#1c1917', color: 'white', padding: '0 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64,
      }}>
        <Link href={`/preview/${domain}`} style={{ color: 'white', textDecoration: 'none', fontSize: 20, fontWeight: 600 }}>
          {site?.name || domain}
        </Link>
        <nav style={{ display: 'flex', gap: 28 }}>
          <Link href={`/preview/${domain}`} style={{ color: '#d6d3d1', textDecoration: 'none', fontSize: 14 }}>홈</Link>
          <Link href={`/preview/${domain}/board`} style={{ color: '#d6d3d1', textDecoration: 'none', fontSize: 14 }}>게시판</Link>
        </nav>
      </header>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ margin: '0 0 12px', fontSize: 22, color: '#1c1917' }}>관리자만 작성할 수 있습니다</h2>
        <p style={{ margin: '0 0 32px', fontSize: 14, color: '#78716c', lineHeight: 1.7 }}>
          게시글은 사이트 관리자 로그인 후 작성 가능합니다.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link href={`/preview/${domain}/board`} style={{
            padding: '12px 24px', background: '#f5f5f4', color: '#1c1917',
            borderRadius: 8, textDecoration: 'none', fontSize: 14,
          }}>
            목록으로
          </Link>
          <Link href="/login" style={{
            padding: '12px 24px', background: '#1c1917', color: 'white',
            borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600,
          }}>
            로그인
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: "'Georgia', serif" }}>

      <header style={{
        background: '#1c1917', color: 'white', padding: '0 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64,
      }}>
        <Link href={`/preview/${domain}`} style={{ color: 'white', textDecoration: 'none', fontSize: 20, fontWeight: 600 }}>
          {site?.name || domain}
        </Link>
        <nav style={{ display: 'flex', gap: 28 }}>
          <Link href={`/preview/${domain}`} style={{ color: '#d6d3d1', textDecoration: 'none', fontSize: 14 }}>홈</Link>
          <Link href={`/preview/${domain}/board`} style={{ color: '#d6d3d1', textDecoration: 'none', fontSize: 14 }}>게시판</Link>
        </nav>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px' }}>
        <Link href={`/preview/${domain}/board`} style={{
          fontSize: 13, color: '#78716c', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 32,
        }}>
          ← 목록으로
        </Link>

        <h2 style={{ margin: '0 0 32px', fontSize: 26, color: '#1c1917' }}>글쓰기</h2>

        <form onSubmit={handleSubmit} style={{
          background: 'white', borderRadius: 12, border: '1px solid #e7e5e4', padding: 36,
        }}>
          {[
            { key: 'author',  label: '작성자',  ph: '이름 (비워두면 관리자)', required: false },
            { key: 'title',   label: '제목 *',  ph: '제목을 입력하세요',    required: true },
          ].map(({ key, label, ph, required }) => (
            <div key={key} style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#78716c', marginBottom: 8 }}>{label}</label>
              <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                placeholder={ph} required={required} style={inputStyle} />
            </div>
          ))}

          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#78716c', marginBottom: 8 }}>내용 *</label>
            <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
              placeholder="내용을 입력하세요" required rows={8}
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 12 }}>
            <Link href={`/preview/${domain}/board`} style={{
              padding: '13px 24px', background: '#f5f5f4', color: '#1c1917',
              borderRadius: 8, textDecoration: 'none', fontSize: 14,
            }}>
              취소
            </Link>
            <button type="submit" disabled={loading} style={{
              flex: 1, padding: '13px', background: '#1c1917', color: 'white',
              border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
              cursor: 'pointer', opacity: loading ? 0.6 : 1,
            }}>
              {loading ? '저장 중...' : '게시글 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
