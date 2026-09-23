'use client'

import { useEffect, useState } from 'react'
import { siteAdminPath } from '@/lib/site-paths'
import { codeLabel, codeColor } from '@/lib/common-codes'
import { lastStaffReply, unreadFrom } from '@/lib/support-ticket'

/**
 * 본사 — 고객 요청 1건 처리 카드 (요청 목록 · 사이트 상세 공통)
 * 내용 확인 → 연락 → 에디터 작업 → 대화로 주고받기 → 답변 보내고 완료
 * 상태·담당자는 메시지를 보낼 때 자동 (별도 「처리 시작」 버튼 없음 — 미발송 혼동 방지)
 *
 * ⚠️ 고객에게 보내는 메시지와 내부 메모는 **입력칸을 분리**한다 (체크박스 토글 금지 — 오발송 사고 방지)
 */
export default function PlatformTicketCard({
  ticket, messages = [], staff, subdomain, onUpdate, onAddMessage, onRead, defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [reply, setReply] = useState('')
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const done = ticket.status === 'resolved'
  const overdue = !done && ticket.deadline_at && new Date(ticket.deadline_at) < new Date()
  const shared = messages.filter(m => !m.is_internal)
  const unreadCustomer = unreadFrom(messages, 'customer')
  const internal = messages.filter(m => m.is_internal)
  const customer = ticket.customers || {}

  // 카드를 펼치면 사장님이 보낸 새 메시지를 읽음 처리
  useEffect(() => {
    if (open && unreadCustomer.length) onRead?.(ticket.ticket_id)
  }, [open, unreadCustomer.length])

  async function run(fn) {
    setBusy(true); setErr('')
    try {
      await fn()
    } catch (e) {
      setErr(e.message || String(e))
    }
    setBusy(false)
  }

  const sendReply = () => run(async () => {
    if (!reply.trim()) throw new Error('고객에게 보낼 내용을 입력해 주세요.')
    await onAddMessage(ticket.ticket_id, { content: reply, isInternal: false })
    await onUpdate(ticket.ticket_id, {
      reply_content: reply.trim(),
      replied_at: new Date().toISOString(),
      status: ticket.status === 'open' ? 'in_progress' : ticket.status,
      handled_by: ticket.handled_by || staff?.staff_id || null,
    })
    setReply('')
  })

  const saveMemo = () => run(async () => {
    if (!memo.trim()) throw new Error('내부 메모 내용을 입력해 주세요.')
    await onAddMessage(ticket.ticket_id, { content: memo, isInternal: true })
    setMemo('')
  })

  const finish = () => run(async () => {
    const text = reply.trim()
    if (!text && !lastStaffReply(messages)) {
      setOpen(true)
      throw new Error('완료하려면 고객에게 처리 결과를 먼저 보내야 합니다.')
    }
    if (text) {
      await onAddMessage(ticket.ticket_id, { content: text, isInternal: false })
    }
    const now = new Date().toISOString()
    await onUpdate(ticket.ticket_id, {
      status: 'resolved',
      resolved_at: now,
      reply_content: text || lastStaffReply(messages).content,
      replied_at: now,
      handled_by: ticket.handled_by || staff?.staff_id || null,
    })
    setReply('')
  })

  const btn = (bg, label, onClick) => (
    <button type="button" onClick={onClick} disabled={busy} style={{
      padding: '7px 14px', background: bg, color: 'white', border: 'none', borderRadius: 6,
      cursor: busy ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, opacity: busy ? 0.6 : 1,
    }}>{label}</button>
  )

  const badge = (color, text) => (
    <span style={{
      padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: color + '22', color, whiteSpace: 'nowrap',
    }}>{text}</span>
  )

  const linkStyle = {
    color: '#93c5fd', textDecoration: 'none', border: '1px solid #334155',
    borderRadius: 6, padding: '5px 10px', fontSize: 12,
  }

  return (
    <div style={{
      background: '#0f172a', border: `1px solid ${overdue ? '#7f1d1d' : '#1e293b'}`,
      borderRadius: 10, padding: '12px 14px', marginBottom: 8,
    }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0,
      }}>
        {badge(codeColor('TICKET_STATUS', ticket.status), codeLabel('TICKET_STATUS', ticket.status))}
        {ticket.priority !== 'normal' && badge(codeColor('TICKET_PRIORITY', ticket.priority), codeLabel('TICKET_PRIORITY', ticket.priority))}
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', flex: 1, minWidth: 120 }}>{ticket.title}</span>
        {unreadCustomer.length > 0
          ? badge('#ef4444', `답장 필요 ${unreadCustomer.length}`)
          : shared.length > 0 && <span style={{ fontSize: 11, color: '#64748b' }}>💬 {shared.length}</span>}
        <span style={{ fontSize: 11, color: '#64748b' }}>
          {codeLabel('TICKET_CATEGORY', ticket.category, ticket.category || '—')}
        </span>
        {ticket.sites?.name && <span style={{ fontSize: 12, color: '#94a3b8' }}>{ticket.sites.name}</span>}
        <span style={{ fontSize: 11, color: overdue ? '#f87171' : '#64748b', whiteSpace: 'nowrap' }}>
          {overdue ? '⚠️ ' : ''}{ticket.deadline_at ? new Date(ticket.deadline_at).toLocaleDateString('ko-KR') : ''}
        </span>
        <span style={{ fontSize: 12, color: '#475569' }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          {/* 요청 내용 + 연락처 */}
          <p style={{
            margin: '0 0 8px', padding: '10px 12px', background: '#111827', borderRadius: 8,
            fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap',
          }}>
            {ticket.content}
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10, fontSize: 12 }}>
            <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{customer.name || '고객'}</span>
            {customer.phone && (
              <a href={`tel:${customer.phone}`} style={linkStyle}>📞 {customer.phone}</a>
            )}
            {customer.email && (
              <a href={`mailto:${customer.email}`} style={linkStyle}>✉️ {customer.email}</a>
            )}
            {!customer.phone && !customer.email && <span style={{ color: '#64748b' }}>연락처 없음</span>}
            <span style={{ marginLeft: 'auto', color: '#475569' }}>
              접수 {new Date(ticket.created_at).toLocaleDateString('ko-KR')}
              {ticket.handled_by && ' · 담당 지정됨'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {subdomain && (
              <a href={siteAdminPath(subdomain, '/editor')} target="_blank" rel="noreferrer" style={linkStyle}>
                🎨 에디터에서 수정 ↗
              </a>
            )}
            {ticket.site_id && (
              <a href={`/platform?site=${ticket.site_id}`} target="_blank" rel="noreferrer"
                style={{ ...linkStyle, color: '#94a3b8' }}>
                사이트 상세 ↗
              </a>
            )}
          </div>

          {/* 고객과 주고받은 대화 */}
          {shared.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {shared.map(m => (
                <div key={m.ticket_message_id} style={{
                  padding: '9px 12px', marginBottom: 6, borderRadius: 8,
                  background: m.author_type === 'staff' ? '#1e293b' : '#111827',
                  borderLeft: `3px solid ${m.author_type === 'staff' ? '#2563eb' : '#475569'}`,
                }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3 }}>
                    <b style={{ color: m.author_type === 'staff' ? '#93c5fd' : '#cbd5e1' }}>
                      {m.author_type === 'staff' ? `본사 ${m.author || ''}` : `${m.author || '사장님'}`}
                    </b>
                    {' · '}{new Date(m.created_at).toLocaleString('ko-KR')}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{m.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* 고객에게 보내는 메시지 */}
          <div style={{ border: '1px solid #2563eb', borderRadius: 8, padding: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', marginBottom: 6 }}>
              📨 고객에게 보내기 — 사장님 화면·알림에 그대로 표시됩니다
            </div>
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              rows={3}
              placeholder="처리 내용이나 확인이 필요한 점을 적어 주세요."
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 11px', background: '#111827',
                border: '1px solid #334155', borderRadius: 7, color: '#e2e8f0', fontSize: 13, resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {btn('#2563eb', '고객에게 보내기', sendReply)}
              {!done && btn('#16a34a', '보내고 완료', finish)}
            </div>
          </div>

          {/* 내부 메모 — 입력칸 자체가 분리되어 있음 */}
          <div style={{ border: '1px dashed #b45309', background: '#1c1207', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 6 }}>
              🔒 내부 메모 — 직원만 봅니다 (고객 화면에 표시되지 않음)
            </div>
            {internal.map(m => (
              <div key={m.ticket_message_id} style={{ padding: '7px 10px', marginBottom: 6, background: '#111827', borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: '#a16207', marginBottom: 3 }}>
                  {m.author || '직원'} · {new Date(m.created_at).toLocaleString('ko-KR')}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#fde68a', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{m.content}</p>
              </div>
            ))}
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              rows={2}
              placeholder="통화 내용, 인수인계, 확인 사항 — 고객에게 보이지 않습니다."
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 11px', background: '#111827',
                border: '1px solid #92400e', borderRadius: 7, color: '#fde68a', fontSize: 13, resize: 'vertical',
              }}
            />
            <div style={{ marginTop: 8 }}>{btn('#b45309', '내부 메모 저장', saveMemo)}</div>
          </div>

          {err && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#f87171' }}>{err}</p>}
        </div>
      )}
    </div>
  )
}
