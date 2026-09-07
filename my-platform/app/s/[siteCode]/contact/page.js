'use client'

import { useState, useEffect } from 'react'
import { use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { onlyActive } from '@/lib/use-flag'
import { sitePublicPath } from '@/lib/site-paths'
import SiteHeader from '@/components/SiteHeader'

/**
 * 사용자 문의 게시판
 * - 목록: 공개글 내용+답글 / 비공개는 안내만
 * - 등록: 이름·연락처·내용·공개/비공개
 * - 연락처는 공개 목록에 미표시
 */
export default function ContactPage({ params }) {
  const { siteCode } = use(params)
  const [site, setSite] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [form, setForm] = useState({
    name: '', phone: '', email: '', content: '', is_private: false,
  })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [siteCode])

  async function load() {
    setLoadingList(true)
    const { data: siteData } = await onlyActive(
      supabase
        .from('sites')
        .select('site_id, name')
        .eq('subdomain', siteCode)
    ).maybeSingle()

    if (!siteData) {
      setLoadingList(false)
      return
    }
    setSite(siteData)

    const { data } = await onlyActive(
      supabase
        .from('user_messages')
        .select('user_message_id, name, content, is_private, reply_content, replied_at, status, created_at')
        .eq('site_id', siteData.site_id)
        .order('created_at', { ascending: false })
    )
    setMessages(data || [])
    setLoadingList(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!site) {
      setError('사이트를 찾을 수 없습니다')
      setLoading(false)
      return
    }
    if (!form.name.trim()) {
      setError('이름을 입력해 주세요')
      setLoading(false)
      return
    }
    if (!form.phone.trim() && !form.email.trim()) {
      setError('연락처(전화 또는 이메일)를 하나 이상 입력해 주세요')
      setLoading(false)
      return
    }

    const { error: err } = await supabase
      .from('user_messages')
      .insert([{
        site_id: site.site_id,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        content: form.content.trim(),
        is_private: Boolean(form.is_private),
        status: 'new',
      }])

    if (err) {
      setError('전송 중 오류: ' + err.message)
      setLoading(false)
      return
    }

    setDone(true)
    setForm({ name: '', phone: '', email: '', content: '', is_private: false })
    setLoading(false)
    await load()
  }

  const inputStyle = {
    width: '100%', padding: '12px 16px',
    border: '1px solid #e7e5e4', borderRadius: 8,
    fontSize: 15, outline: 'none',
    boxSizing: 'border-box', color: '#1c1917', background: 'white',
  }

  const siteName = site?.name || siteCode

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: "'Georgia', serif" }}>
      <SiteHeader siteName={siteName} siteCode={siteCode} activePage="contact" />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px 80px' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 28, color: '#1c1917' }}>문의</h2>
        <p style={{ margin: '0 0 36px', fontSize: 14, color: '#78716c' }}>
          남기신 문의에 운영자가 답변합니다. 연락처는 목록에 공개되지 않습니다.
        </p>

        {/* 목록 */}
        <section style={{ marginBottom: 48 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#44403c' }}>
            문의 목록 {loadingList ? '' : `(${messages.length})`}
          </h3>

          {loadingList ? (
            <p style={{ color: '#a8a29e', fontSize: 14 }}>불러오는 중...</p>
          ) : messages.length === 0 ? (
            <div style={{
              padding: '40px 24px', textAlign: 'center', color: '#a8a29e',
              background: 'white', borderRadius: 12, border: '1px solid #e7e5e4',
            }}>
              아직 문의가 없습니다
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.map(msg => (
                <article key={msg.user_message_id} style={{
                  background: 'white', borderRadius: 12, border: '1px solid #e7e5e4',
                  padding: '20px 22px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1917' }}>
                      {msg.is_private ? '비공개 문의' : maskName(msg.name)}
                    </span>
                    <span style={{ fontSize: 12, color: '#a8a29e', whiteSpace: 'nowrap' }}>
                      {new Date(msg.created_at).toLocaleDateString('ko-KR')}
                      {msg.status === 'replied' || msg.reply_content ? ' · 답변완료' : ' · 대기'}
                    </span>
                  </div>

                  {msg.is_private ? (
                    <p style={{ margin: 0, fontSize: 14, color: '#78716c', lineHeight: 1.6 }}>
                      🔒 비공개 문의입니다. 운영자만 내용을 확인할 수 있습니다.
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontSize: 15, color: '#292524', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </p>
                  )}

                  {!msg.is_private && msg.reply_content && (
                    <div style={{
                      marginTop: 14, padding: '14px 16px',
                      background: '#f5f5f4', borderRadius: 8, borderLeft: '3px solid #1c1917',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#78716c', marginBottom: 6 }}>
                        운영자 답변
                        {msg.replied_at && (
                          <span style={{ fontWeight: 500, marginLeft: 8 }}>
                            {new Date(msg.replied_at).toLocaleDateString('ko-KR')}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 14, color: '#1c1917', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                        {msg.reply_content}
                      </p>
                    </div>
                  )}

                  {msg.is_private && msg.reply_content && (
                    <p style={{ margin: '10px 0 0', fontSize: 13, color: '#a8a29e' }}>
                      ✓ 운영자가 답변했습니다 (비공개)
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* 등록 */}
        <section>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#44403c' }}>문의 남기기</h3>

          {done ? (
            <div style={{
              background: 'white', borderRadius: 12, border: '1px solid #e7e5e4',
              padding: 40, textAlign: 'center',
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <h4 style={{ margin: '0 0 8px', fontSize: 18, color: '#1c1917' }}>접수되었습니다</h4>
              <p style={{ margin: '0 0 24px', fontSize: 14, color: '#78716c' }}>
                운영자가 확인 후 답변합니다.
              </p>
              <button
                type="button"
                onClick={() => setDone(false)}
                style={{
                  padding: '12px 24px', background: '#1c1917', color: 'white',
                  border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer',
                }}
              >
                추가 문의하기
              </button>
              <div style={{ marginTop: 16 }}>
                <Link href={sitePublicPath(siteCode)} style={{ fontSize: 13, color: '#78716c' }}>
                  홈으로
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{
              background: 'white', borderRadius: 12, border: '1px solid #e7e5e4', padding: 32,
            }}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#78716c', marginBottom: 8 }}>이름 *</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="홍길동"
                  required
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#78716c', marginBottom: 8 }}>전화</label>
                <input
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="010-0000-0000"
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#78716c', marginBottom: 8 }}>이메일</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#78716c', marginBottom: 8 }}>내용 *</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  placeholder="문의 내용을 적어 주세요"
                  required
                  rows={5}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                marginBottom: 24, fontSize: 14, color: '#44403c', cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={form.is_private}
                  onChange={e => setForm({ ...form, is_private: e.target.checked })}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <strong>비공개로 남기기</strong>
                  <span style={{ display: 'block', fontSize: 12, color: '#78716c', marginTop: 2 }}>
                    목록에 내용이 보이지 않고, 운영자만 확인할 수 있습니다
                  </span>
                </span>
              </label>

              {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</p>}

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: 14,
                background: '#1c1917', color: 'white',
                border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
                cursor: 'pointer', opacity: loading ? 0.6 : 1,
              }}>
                {loading ? '전송 중...' : '문의 보내기'}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}

function maskName(name) {
  if (!name) return '익명'
  if (name.length <= 1) return name
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*'.repeat(Math.min(name.length - 2, 3)) + name[name.length - 1]
}
