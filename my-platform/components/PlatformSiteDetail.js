'use client'

import { useState, useEffect } from 'react'
import { sitePublicPath } from '@/lib/site-paths'
import { INQUIRY_CUSTOMER_STEPS, getInquiryStepIndex } from '@/lib/payment/one-time'
import { getSitePeriodInfo } from '@/lib/site-period'
import { codeLabel, codeColor } from '@/lib/common-codes'

const SITE_STATUS_OPTS = ['draft', 'review', 'published', 'suspended', 'cancelled']
const DEPLOY_STATUS_OPTS = ['pending', 'building', 'live', 'failed']

const SELF_STEPS = [
  { key: 'draft', label: '준비중' },
  { key: 'live', label: '배포·체험' },
  { key: 'active', label: '구독운영' },
  { key: 'suspended', label: '정지' },
]

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
        maxWidth: '100%',
      }}
    >
      {ok ? '✓ 복사됨' : shown}
    </button>
  )
}

function Stepper({ steps, currentIndex }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 8, flexWrap: 'wrap' }}>
      {steps.map((step, i) => (
        <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none', minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: i <= currentIndex ? '#e2e8f0' : '#1e293b',
              color: i <= currentIndex ? '#0f172a' : '#64748b',
            }}>
              {i < currentIndex ? '✓' : i + 1}
            </div>
            <span style={{
              fontSize: 9, color: i === currentIndex ? '#f1f5f9' : '#64748b',
              fontWeight: i === currentIndex ? 700 : 400, whiteSpace: 'nowrap',
            }}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              flex: 1, height: 2, minWidth: 12,
              background: i < currentIndex ? '#e2e8f0' : '#1e293b',
              margin: '0 4px', marginBottom: 14,
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

function getSelfStepIndex(site, sub) {
  if (site.status === 'suspended' || site.status === 'cancelled') return 3
  if (sub?.status === 'active') return 2
  if (site.status === 'published' || site.trial_started_at || sub?.status === 'trial') return 1
  return 0
}

function moneyLabel(inquiry, otpDevFee) {
  if (!inquiry?.dev_fee_total) return null
  const half = Math.floor(inquiry.dev_fee_total / 2)
  const down = inquiry.down_paid_at ? '납부' : '미납'
  let final = '미납'
  if (inquiry.final_paid_at) final = '확인완료'
  else if (otpDevFee?.status === 'pending_confirm') final = codeLabel('OTP_STATUS', 'pending_confirm')
  else if (otpDevFee?.status === 'paid') final = `${codeLabel('OTP_STATUS', 'paid')} · 문의 미반영`
  else if (otpDevFee?.status === 'unpaid') final = `${codeLabel('OTP_STATUS', 'unpaid')}(청구있음)`
  return { half, down, final, total: inquiry.dev_fee_total }
}

function emptyEdit(site) {
  return {
    name: site.name || '',
    subdomain: site.subdomain || '',
    domain: site.domain || '',
    description: site.description || '',
    address: site.address || '',
    phone: site.phone || '',
    email: site.email || '',
    status: site.status || 'draft',
    deploy_status: site.deploy_status || 'pending',
  }
}

/**
 * 관리자용 사이트 상세 — 흐름·돈·수정·삭제
 */
export default function PlatformSiteDetail({
  site,
  inquiry,
  subscription,
  oneTimePays = [],
  onClose,
  onStatusAction,
  onConfirmFinal,
  onGoInquiries,
  onGoPayments,
  onGoCustomer,
  onSave,
  onDelete,
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => emptyEdit(site))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setEditing(false)
    setForm(emptyEdit(site))
    setMsg('')
  }, [site.site_id])

  if (!site) return null

  const isManaged = site.build_type === 'managed'
  const otpDevFees = oneTimePays.filter(p => p.type === 'dev_fee')
  const otpLatest = otpDevFees[0] || null
  const money = moneyLabel(inquiry, otpLatest)
  const period = getSitePeriodInfo(site, subscription)
  const trialEnds = site.trial_ends_at ? new Date(site.trial_ends_at) : null
  const daysLeft = period.daysLeft

  let flowTitle = '진행 상태'
  let flowHint = ''
  let stepIndex = 0
  let steps = SELF_STEPS

  if (isManaged) {
    steps = INQUIRY_CUSTOMER_STEPS
    if (inquiry) {
      stepIndex = getInquiryStepIndex(inquiry.status)
      flowTitle = '본사 대리 제작 흐름'
      flowHint = INQUIRY_CUSTOMER_STEPS[stepIndex]?.desc || ''
    } else {
      flowTitle = '본사 대리 (문의 미연결)'
      flowHint = 'sites.inquiry_id 가 없거나 문의를 찾을 수 없습니다.'
      stepIndex = -1
    }
  } else {
    stepIndex = getSelfStepIndex(site, subscription)
    flowTitle = '고객 직접 제작 흐름'
    flowHint = ['준비중', '배포·체험', '구독 운영', '정지/해지'][stepIndex] || ''
  }

  const nextActions = []
  if (isManaged && site.status === 'draft') {
    nextActions.push({ label: '검수용 공개', color: '#8b5cf6', run: () => onStatusAction?.(site.site_id, 'review') })
  }
  if (!isManaged && site.status === 'draft') {
    nextActions.push({ label: '배포', color: '#16a34a', run: () => onStatusAction?.(site.site_id, 'published') })
  }
  if (site.status === 'published') {
    nextActions.push({ label: '정지', color: '#dc2626', run: () => onStatusAction?.(site.site_id, 'suspended') })
  }
  if (site.status === 'suspended') {
    nextActions.push({
      label: '복구',
      color: '#2563eb',
      run: () => onStatusAction?.(
        site.site_id,
        isManaged && !site.trial_started_at ? 'review' : 'published'
      ),
    })
  }
  if (isManaged && inquiry && ['building', 'review'].includes(inquiry.status) && !inquiry.final_paid_at) {
    nextActions.push({ label: '잔금 확인', color: '#2563eb', run: () => onConfirmFinal?.(inquiry.inquiry_id) })
  }
  if (otpLatest?.status === 'pending_confirm') {
    nextActions.push({ label: '1회성결제로', color: '#f59e0b', run: () => onGoPayments?.() })
  }
  if (inquiry) {
    nextActions.push({ label: '제작 문의로', color: '#64748b', run: () => onGoInquiries?.() })
  }
  if (site.customer_id && onGoCustomer) {
    nextActions.push({ label: '이 회원 보기', color: '#38bdf8', run: () => onGoCustomer(site.customer_id) })
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.subdomain.trim()) {
      setMsg('❌ sites.name / sites.subdomain 은 필수입니다.')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      await onSave?.(site.site_id, {
        name: form.name.trim(),
        subdomain: form.subdomain.trim(),
        domain: form.domain.trim() || null,
        description: form.description.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        status: form.status,
        deploy_status: form.deploy_status,
      })
      setMsg('✅ sites 저장됨')
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
      await onDelete?.(site)
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
      {opts.type === 'textarea' ? (
        <textarea
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      ) : opts.type === 'select' ? (
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
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>사이트 상세</div>
          <h3 style={{ margin: 0, fontSize: 18, color: '#f1f5f9', fontWeight: 800 }}>{site.name}</h3>
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {badge(codeColor('SITE_STATUS', site.status), codeLabel('SITE_STATUS', site.status))}
            {badge(codeColor('DEPLOY_STATUS', site.deploy_status),
              codeLabel('DEPLOY_STATUS', site.deploy_status, site.deploy_status || '—'))}
            {badge(codeColor('BUILD_TYPE', site.build_type), codeLabel('BUILD_TYPE', site.build_type))}
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

      <Section title="식별 · 고객">
        <Row label="sites.site_id"><CopyValue value={site.site_id} /></Row>
        <Row label="sites.site_code"><CopyValue value={site.site_code} short={20} /></Row>
        <Row label="sites.subdomain">
          <a href={sitePublicPath(site.subdomain)} target="_blank" rel="noreferrer"
            style={{ color: '#60a5fa' }}>{site.subdomain} →</a>
        </Row>
        <Row label="sites.domain">{site.domain || 'NULL'}</Row>
        <Row label="customers">
          {site.customers?.name} ({site.customers?.email})
          {site.customer_id && onGoCustomer && (
            <button
              type="button"
              onClick={() => onGoCustomer(site.customer_id)}
              style={{
                marginLeft: 8, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
                background: '#0c4a6e', color: '#7dd3fc', border: '1px solid #0369a1', borderRadius: 5,
              }}
            >
              회원으로 →
            </button>
          )}
        </Row>
        <Row label="sites.inquiry_id"><CopyValue value={site.inquiry_id} /></Row>
      </Section>

      <Section title={flowTitle}>
        {stepIndex >= 0 && <Stepper steps={steps} currentIndex={stepIndex} />}
        {flowHint && (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
            {flowHint}
          </p>
        )}
        {isManaged && inquiry && (
          <div style={{ marginTop: 8 }}>
            <Row label="inquiries.status">
              {codeLabel('INQUIRY_STATUS', inquiry.status)} ({inquiry.status})
            </Row>
            <Row label="sites.status">
              {codeLabel('SITE_STATUS', site.status)} ({site.status})
            </Row>
          </div>
        )}
      </Section>

      <Section title="돈 · 결제">
        {money ? (
          <>
            <Row label="inquiries.dev_fee_total">{money.total.toLocaleString()}원</Row>
            <Row label="inquiries.down_paid_at">
              {inquiry.down_paid_at
                ? `✓ ${new Date(inquiry.down_paid_at).toLocaleDateString('ko-KR')} (${money.half.toLocaleString()}원 · ${money.down})`
                : `NULL · 선금 ${money.half.toLocaleString()}원 ${money.down}`}
            </Row>
            <Row label="inquiries.final_paid_at">
              {inquiry.final_paid_at
                ? `✓ ${new Date(inquiry.final_paid_at).toLocaleDateString('ko-KR')}`
                : `NULL · 잔금 ${money.half.toLocaleString()}원 · ${money.final}`}
            </Row>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            {isManaged ? '연결된 문의에 개발비(dev_fee_total) 없음' : '직접 제작 — 개발비 잔금 없음 (월 구독만)'}
          </p>
        )}

        {otpDevFees.length === 0 ? (
          <Row label="one_time_payments">행 없음</Row>
        ) : otpDevFees.map(p => (
          <Row key={p.payment_id} label={<><span>OTP </span><CopyValue value={p.payment_id} short={6} /></>}>
            type={codeLabel('OTP_TYPE', p.type)} · status=
            <strong style={{ color: codeColor('OTP_STATUS', p.status) }}>
              {codeLabel('OTP_STATUS', p.status)}
            </strong>
            {' · '}{p.amount?.toLocaleString()}원
          </Row>
        ))}

        {subscription ? (
          <>
            <Row label="subscriptions.status">
              {codeLabel('SUB_STATUS', subscription.status)} ({subscription.status})
            </Row>
            <Row label="subscriptions.amount">{subscription.amount?.toLocaleString()}원 / 월</Row>
            <Row label="subscriptions.payment_method">
              {codeLabel('PAYMENT_METHOD', subscription.payment_method, subscription.payment_method || 'NULL')}
            </Row>
            <Row label="subscriptions.next_billing_date">{subscription.next_billing_date || 'NULL'}</Row>
          </>
        ) : (
          <Row label="subscriptions">행 없음</Row>
        )}

        <Row label="기간">
          <span style={{ color: period.color, fontWeight: 700 }}>{period.label}</span>
          {period.subLabel ? ` · ${period.subLabel}` : ''}
        </Row>
        <Row label="기간 상세">{period.detail}</Row>
        <Row label="sites.trial_*">
          {site.trial_started_at
            ? `시작 ${new Date(site.trial_started_at).toLocaleDateString('ko-KR')} · 종료 ${trialEnds ? trialEnds.toLocaleDateString('ko-KR') : '—'} (D-${daysLeft ?? '?'})`
            : 'NULL (체험 미시작)'}
        </Row>
      </Section>

      <Section title="다음에 할 일">
        {nextActions.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>특별 액션 없음</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {nextActions.map(a => (
              <button
                key={a.label}
                type="button"
                onClick={a.run}
                style={{
                  padding: '8px 12px', background: a.color + '22', color: a.color,
                  border: `1px solid ${a.color}55`, borderRadius: 7, cursor: 'pointer',
                  fontSize: 12, fontWeight: 700,
                }}
              >
                {a.label}
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
              onClick={() => { setForm(emptyEdit(site)); setEditing(true); setMsg('') }}
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
            {field('name', 'sites.name *')}
            {field('subdomain', 'sites.subdomain *')}
            {field('domain', 'sites.domain')}
            {field('phone', 'sites.phone')}
            {field('email', 'sites.email')}
            {field('address', 'sites.address')}
            {field('description', 'sites.description', { type: 'textarea' })}
            {field('status', 'sites.status', { type: 'select', options: SITE_STATUS_OPTS, codeGroup: 'SITE_STATUS' })}
            {field('deploy_status', 'sites.deploy_status', { type: 'select', options: DEPLOY_STATUS_OPTS, codeGroup: 'DEPLOY_STATUS' })}
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
                onClick={() => { setEditing(false); setForm(emptyEdit(site)); setMsg('') }}
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
          삭제는 물리 DELETE가 아니라 <code style={{ color: '#94a3b8' }}>sites.use_flag = 0</code> 입니다.
        </p>
        {subscription && (
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#f59e0b' }}>
            subscriptions 행이 있어도 soft delete는 가능합니다.
          </p>
        )}
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
