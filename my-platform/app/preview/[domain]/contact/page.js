'use client'
import { useState } from 'react'
import { use } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'

const CATEGORIES = [
  { value: 'text_change', label: '텍스트 수정' },
  { value: 'image',       label: '이미지 교체' },
  { value: 'page_add',    label: '페이지 추가' },
  { value: 'feature',     label: '기능 추가' },
  { value: 'etc',         label: '기타 문의' },
]

export default function ContactPage({ params }) {
  const { domain } = use(params)
  const [form, setForm] = useState({ name: '', title: '', content: '', category: 'etc' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const subdomain = domain.split('.')[0]
    const { data: site } = await supabase
      .from('sites')
      .select('site_id, customer_id')
      .or(`domain.eq.${domain},subdomain.eq.${subdomain}`)
      .single()

    if (!site) {
      setError('사이트를 찾을 수 없습니다')
      setLoading(false)
      return
    }

    const { error: err } = await supabase
      .from('support_tickets')
      .insert([{
        site_id:      site.site_id,      // UUID FK
        customer_id:  site.customer_id,  // UUID FK
        title:        form.name ? `[${form.name}] ${form.title}` : form.title,
        content:      form.content,
        category:     form.category,
        status:       'open',
        priority:     'normal',
        deadline_days: 3,
        deadline_at:  new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      }])

    if (err) {
      setError('전송 중 오류: ' + err.message)
    } else {
      setDone(true)
    }
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', padding: '12px 16px',
    border: '1px solid #e7e5e4', borderRadius: 8,
    fontSize: 15, outline: 'none',
    boxSizing: 'border-box', color: '#1c1917', background: 'white',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: "'Georgia', serif" }}>

      <SiteHeader siteName="홈" domain={domain} activePage="contact" />

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 20px' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 28, color: '#1c1917' }}>문의 / 수정 요청</h2>
        <p style={{ margin: '0 0 40px', fontSize: 14, color: '#78716c' }}>3영업일 이내 처리해드립니다</p>

        {done ? (
          <div style={{
            background: 'white', borderRadius: 12, border: '1px solid #e7e5e4',
            padding: 48, textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h3 style={{ margin: '0 0 12px', color: '#1c1917', fontSize: 20 }}>접수 완료!</h3>
            <p style={{ color: '#78716c', fontSize: 14, marginBottom: 28 }}>
              3영업일 이내 처리해드릴게요
            </p>
            <Link href={`/preview/${domain}`} style={{
              display: 'inline-block', padding: '12px 28px',
              background: '#1c1917', color: 'white',
              borderRadius: 8, textDecoration: 'none', fontSize: 14,
            }}>
              홈으로 돌아가기
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{
            background: 'white', borderRadius: 12, border: '1px solid #e7e5e4', padding: 36,
          }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#78716c', marginBottom: 8 }}>이름</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="홍길동" style={inputStyle} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#78716c', marginBottom: 8 }}>문의 유형</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                style={inputStyle}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#78716c', marginBottom: 8 }}>제목 *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="요청 제목을 입력하세요" required style={inputStyle} />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#78716c', marginBottom: 8 }}>내용 *</label>
              <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
                placeholder="수정/문의 내용을 자세히 적어주세요" required rows={5}
                style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: 14,
              background: '#1c1917', color: 'white',
              border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
              cursor: 'pointer', opacity: loading ? 0.6 : 1,
            }}>
              {loading ? '전송 중...' : '문의 접수하기'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
