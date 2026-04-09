'use client'
import { useState } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function WritePostPage({ params }) {
  const { domain } = use(params)
  const router = useRouter()
  const [form, setForm] = useState({ title: '', content: '', author: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // 사이트 조회 (site_id UUID 가져오기)
    const subdomain = domain.split('.')[0]
    const { data: site } = await supabase
      .from('sites')
      .select('site_id')
      .or(`domain.eq.${domain},subdomain.eq.${subdomain}`)
      .single()

    if (!site) {
      setError('사이트를 찾을 수 없습니다')
      setLoading(false)
      return
    }

    // 게시글 저장 (site_id = UUID FK)
    const { error: insertError } = await supabase
      .from('posts')
      .insert([{
        site_id: site.site_id,   // UUID FK
        title: form.title,
        content: form.content,
        author: form.author || '익명',
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

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: "'Georgia', serif" }}>

      <header style={{
        background: '#1c1917', color: 'white', padding: '0 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64,
      }}>
        <Link href={`/preview/${domain}`} style={{ color: 'white', textDecoration: 'none', fontSize: 20, fontWeight: 600 }}>
          {domain}
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
            { key: 'author',  label: '작성자',  ph: '이름 (비워두면 익명)', required: false, type: 'input' },
            { key: 'title',   label: '제목 *',  ph: '제목을 입력하세요',    required: true,  type: 'input' },
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
