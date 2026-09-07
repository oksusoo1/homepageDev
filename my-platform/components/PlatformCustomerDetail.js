'use client'

import { useState, useEffect } from 'react'
import { sitePublicPath } from '@/lib/site-paths'
import { codeLabel, codeColor } from '@/lib/common-codes'

const CUST_STATUS_OPTS = ['active', 'suspended', 'withdrawn']

const inputStyle = {
  width: '100%', padding: '7px 10px', background: '#0f172a', color: '#e2e8f0',
  border: '1px solid #334155', borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
}

function badge(color, text) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, color, background: color + '22',
      border: `1px solid ${color}44`,
    }}>{text}</span>
  )
}

function Row({ label, children }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start',
      padding: '8px 0', borderBottom: '1px solid #1e293b', fontSize: 13,
    }}>
      <span style={{ color: '#64748b', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 11, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ color: '#e2e8f0', textAlign: 'right', minWidth: 0, wordBreak: 'break-all' }}>{children}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', marginBottom: 8, letterSpacing: 0.4 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function CopyValue({ value, short = 8 }) {
  const [ok, setOk] = useState(false)
  if (!value) return <span style={{ color: '#64748b' }}>NULL</span>

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setOk(true)
      setTimeout(() => setOk(false), 1200)
    } catch {
      window.prompt('복사하세요', value)
    }
  }

  const shown = value.length > short ? `${value.slice(0, short)}…` : value
  return (
    <button
      type="button"
      title={`클릭하면 전체 복사\n${value}`}
      onClick={copy}
      style={{
        background: ok ? '#052e16' : '#0f172a',
        border: `1px solid ${ok ? '#16a34a' : '#334155'}`,
        color: ok ? '#86efac' : '#e2e8f0',
        borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
        fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12,
      }}
    >
      {ok ? '✓ 복사됨' : shown}
    </button>
  )
}

function emptyEdit(c) {
  return {
    name: c.name || '',
    email: c.email || '',
    phone: c.phone || '',
    status: c.status || 'active',
  }
}

/**
 * 관리자용 회원(customers) 상세 — 보유 사이트·요약·수정·soft delete
 */
export default function PlatformCustomerDetail({
  customer,
  sites = [],
  inquiries = [],
  subscriptions = [],
  oneTimePays = [],
  onClose,
  onOpenSite,
  onSave,
  onSoftDelete,
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => emptyEdit(customer))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setEditing(false)
    setForm(emptyEdit(customer))
    setMsg('')
  }, [customer.customer_id])

  if (!customer) return null

  const mySites = sites.filter(s => s.customer_id === customer.customer_id)
  const myInq = inquiries.filter(i => i.customer_id === customer.customer_id)
  const mySubs = subscriptions.filter(s => s.customer_id === customer.customer_id)
  const pendingOtp = oneTimePays.filter(
    p => p.customer_id === customer.customer_id && p.status === 'pending_confirm'
  )
  const openInq = myInq.filter(i => i.status !== 'done')

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) {
      setMsg('❌ customers.name / customers.email 은 필수입니다.')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      await onSave?.(customer.customer_id, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        status: form.status,
      })
      setMsg('✅ customers 저장됨')
      setEditing(false)
    } catch (err) {
      setMsg('❌ ' + (err.message || String(err)))
    }
    setBusy(false)
  }

  async function handleDelete() {
    setBusy(true)
    setMsg('')
    try {
      await onSoftDelete?.(customer)
    } catch (err) {
      setMsg('❌ ' + (err.message || String(err)))
    }
    setBusy(false)
  }

  const field = (key, label, opts = {}) => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4, fontFamily: 'ui-monospace, Consolas, monospace' }}>
        {label}
      </label>
      {opts.type === 'select' ? (
        <select
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          {opts.options.map(o => (
            <option key={o} value={o}>
              {opts.codeGroup ? `${codeLabel(opts.codeGroup, o)} (${o})` : o}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          style={inputStyle}
        />
      )}
    </div>
  )

  return (
    <div style={{
      background: '#111827', border: '1px solid #334155', borderRadius: 12,
      padding: 20, position: 'sticky', top: 16, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>회원 상세 · customers</div>
          <h3 style={{ margin: 0, fontSize: 18, color: '#f1f5f9', fontWeight: 800 }}>{customer.name}</h3>
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {badge(codeColor('CUSTOMER_STATUS', customer.status),
              codeLabel('CUSTOMER_STATUS', customer.status))}
            {badge('#64748b', `사이트 ${mySites.length}개`)}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
            borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12,
          }}
        >
          닫기
        </button>
      </div>

      <Section title="식별 · 연락처">
        <Row label="customers.customer_id"><CopyValue value={customer.customer_id} /></Row>
        <Row label="customers.auth_id"><CopyValue value={customer.auth_id} /></Row>
        <Row label="customers.email">{customer.email}</Row>
        <Row label="customers.phone">{customer.phone || 'NULL'}</Row>
        <Row label="customers.withdraw_at">
          {customer.withdraw_at ? new Date(customer.withdraw_at).toLocaleString('ko-KR') : 'NULL'}
        </Row>
        <Row label="customers.created_at">
          {customer.created_at ? new Date(customer.created_at).toLocaleDateString('ko-KR') : '—'}
        </Row>
      </Section>

      <Section title="요약">
        <Row label="보유 사이트">{mySites.length}개</Row>
        <Row label="진행 중 문의">{openInq.length}건</Row>
        <Row label="구독 행">{mySubs.length}건
          {mySubs[0] ? ` · ${mySubs.map(s => s.status).join(', ')}` : ''}
        </Row>
        <Row label="입금확인대기 OTP">{pendingOtp.length}건</Row>
      </Section>

      <Section title="보유 사이트 (sites)">
        {mySites.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>연결된 사이트 없음</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mySites.map(s => (
              <button
                key={s.site_id}
                type="button"
                onClick={() => onOpenSite?.(s.site_id)}
                style={{
                  textAlign: 'left', padding: '10px 12px', background: '#0f172a',
                  border: '1px solid #334155', borderRadius: 8, cursor: 'pointer', color: '#e2e8f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {s.subdomain}
                      {s.domain ? ` · ${s.domain}` : ''}
                      {' · '}
                      <a
                        href={sitePublicPath(s.subdomain)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ color: '#60a5fa' }}
                      >미리보기</a>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {badge(codeColor('SITE_STATUS', s.status), codeLabel('SITE_STATUS', s.status))}
                    {badge(codeColor('BUILD_TYPE', s.build_type),
                      codeLabel('BUILD_TYPE', s.build_type))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title="수정 · 삭제">
        {!editing ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => { setForm(emptyEdit(customer)); setEditing(true); setMsg('') }}
              style={{
                padding: '8px 14px', background: '#2563eb', color: 'white',
                border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700,
              }}
            >
              수정
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
              style={{
                padding: '8px 14px', background: 'transparent', color: '#fca5a5',
                border: '1px solid #7f1d1d', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700,
              }}
            >
              삭제 (use_flag=0)
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave}>
            {field('name', 'customers.name *')}
            {field('email', 'customers.email *')}
            {field('phone', 'customers.phone')}
            {field('status', 'customers.status', { type: 'select', options: CUST_STATUS_OPTS, codeGroup: 'CUSTOMER_STATUS' })}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                type="submit"
                disabled={busy}
                style={{
                  padding: '8px 14px', background: '#16a34a', color: 'white',
                  border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? '저장 중…' : '저장'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => { setEditing(false); setForm(emptyEdit(customer)); setMsg('') }}
                style={{
                  padding: '8px 14px', background: 'transparent', color: '#94a3b8',
                  border: '1px solid #334155', borderRadius: 7, cursor: 'pointer', fontSize: 13,
                }}
              >
                취소
              </button>
            </div>
          </form>
        )}
        <p style={{ margin: '10px 0 0', fontSize: 11, color: '#64748b' }}>
          삭제는 <code style={{ color: '#94a3b8' }}>customers.use_flag = 0</code> (사이트는 그대로 남을 수 있음)
        </p>
      </Section>

      {msg && (
        <div style={{
          marginTop: 8, padding: '10px 12px', borderRadius: 8, fontSize: 12,
          background: msg.startsWith('✅') ? '#052e16' : '#450a0a',
          color: msg.startsWith('✅') ? '#86efac' : '#fca5a5',
          fontFamily: 'ui-monospace, Consolas, monospace',
        }}>
          {msg}
        </div>
      )}
    </div>
  )
}
