'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { onlyActive } from '@/lib/use-flag'

/**
 * 고객 포털 — 방문자 문의 수신·답변
 */
export default function UserMessagesInbox({ siteId }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [replyDrafts, setReplyDrafts] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (siteId) fetchMessages()
  }, [siteId])

  async function fetchMessages() {
    setLoading(true)
    const { data } = await onlyActive(
      supabase
        .from('user_messages')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
    )
    setMessages(data || [])
    setLoading(false)
  }

  async function submitReply(messageId) {
    const text = (replyDrafts[messageId] || '').trim()
    if (!text) {
      setMsg('답변 내용을 입력해 주세요')
      return
    }
    setSavingId(messageId)
    setMsg('')

    const now = new Date().toISOString()
    const { error } = await supabase
      .from('user_messages')
      .update({
        reply_content: text,
        replied_at: now,
        status: 'replied',
        updated_at: now,
      })
      .eq('user_message_id', messageId)
      .eq('site_id', siteId)

    if (error) {
      setMsg('저장 실패: ' + error.message)
    } else {
      setReplyDrafts(prev => ({ ...prev, [messageId]: '' }))
      await fetchMessages()
      setMsg('답변이 등록되었습니다')
    }
    setSavingId(null)
  }

  if (loading) {
    return <p style={{ color: '#9ca3af', fontSize: 14 }}>불러오는 중...</p>
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#111827' }}>방문자 문의</h2>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
          공개 사이트 문의입니다. 답변은 공개 글에만 목록에 표시됩니다.
        </p>
      </div>

      {msg && (
        <p style={{ fontSize: 13, color: msg.includes('실패') ? '#ef4444' : '#15803d', marginBottom: 16 }}>
          {msg}
        </p>
      )}

      {messages.length === 0 ? (
        <div style={{
          background: 'white', borderRadius: 14, border: '1px solid #e5e7eb',
          padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14,
        }}>
          아직 들어온 문의가 없습니다
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.map(m => (
            <div key={m.user_message_id} style={{
              background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', padding: 22,
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <strong style={{ fontSize: 15, color: '#111827' }}>{m.name}</strong>
                {m.is_private && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: '#fef3c7', color: '#b45309',
                  }}>비공개</span>
                )}
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: m.reply_content ? '#dcfce7' : '#fee2e2',
                  color: m.reply_content ? '#15803d' : '#b91c1c',
                }}>
                  {m.reply_content ? '답변완료' : '미답변'}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>
                  {new Date(m.created_at).toLocaleString('ko-KR')}
                </span>
              </div>

              <p style={{ margin: '0 0 10px', fontSize: 14, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {m.content}
              </p>

              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
                {m.phone && <span style={{ marginRight: 12 }}>📞 {m.phone}</span>}
                {m.email && <span>✉️ {m.email}</span>}
                {!m.phone && !m.email && <span>연락처 없음</span>}
              </div>

              {m.reply_content ? (
                <div style={{
                  padding: '12px 14px', background: '#f9fafb', borderRadius: 8,
                  borderLeft: '3px solid #111827', marginBottom: 12,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>내 답변</div>
                  <p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.reply_content}</p>
                </div>
              ) : null}

              <textarea
                value={replyDrafts[m.user_message_id] ?? (m.reply_content || '')}
                onChange={e => setReplyDrafts(prev => ({ ...prev, [m.user_message_id]: e.target.value }))}
                placeholder="답변을 입력하세요"
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
                  borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  resize: 'vertical', marginBottom: 10,
                }}
              />
              <button
                type="button"
                disabled={savingId === m.user_message_id}
                onClick={() => submitReply(m.user_message_id)}
                style={{
                  padding: '9px 18px', background: '#111827', color: 'white',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', opacity: savingId === m.user_message_id ? 0.6 : 1,
                }}
              >
                {savingId === m.user_message_id ? '저장 중...' : (m.reply_content ? '답변 수정' : '답변 등록')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
