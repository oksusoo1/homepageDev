'use client'

import { useState, useEffect } from 'react'
import { sitePublicPath, siteAdminPath } from '@/lib/site-paths'
import { getSitePeriodInfo } from '@/lib/site-period'
import { codeLabel, codeColor } from '@/lib/common-codes'
import {
  FLOW_STEPS,
  SELF_FLOW_STEPS,
  resolveManagedFlowStep,
  resolveSelfFlowStep,
  resolveHqInquiryAction,
  flowStepLabel,
  flowStepDesc,
  getFlowStepIndex,
  canOpenHqEditor,
} from '@/lib/flow-step'
import { canCancelManagedIntake } from '@/lib/managed-flow'
import { subscriptionLifeLabel } from '@/lib/subscription-life'
import PlatformTicketCard from '@/components/PlatformTicketCard'

const FLOW_STATUS_OPTS = [...FLOW_STEPS]

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
  // 단계가 9개까지 — 좁은 패널에서 글자가 겹치지 않도록 가로 스크롤 + 최소 폭
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 8, overflowX: 'auto', paddingBottom: 4 }}>
      {steps.map((step, i) => (
        <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: '0 0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 58 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: i <= currentIndex ? '#e2e8f0' : '#1e293b',
              color: i <= currentIndex ? '#0f172a' : '#64748b',
            }}>
              {i < currentIndex ? '✓' : i + 1}
            </div>
            <span style={{
              fontSize: 9.5, lineHeight: 1.25, textAlign: 'center', wordBreak: 'keep-all',
              color: i === currentIndex ? '#f1f5f9' : '#64748b',
              fontWeight: i === currentIndex ? 700 : 400,
            }}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              width: 10, height: 2, flexShrink: 0, marginBottom: 18,
              background: i < currentIndex ? '#e2e8f0' : '#1e293b',
            }} />
          )}
        </div>
      ))}
    </div>
  )
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
    status: site.status || 'building',
  }
}

/**
 * 본사 사이트 상세 = 사이트 한 곳의 모든 업무 화면
 * 흐름 · 제작의뢰(견적·선금·잔금·메모) · 1회성 결제 · 구독·청구 · 고객 요청 · 수정·삭제
 */
export default function PlatformSiteDetail({
  site,
  inquiry,
  subscription,
  oneTimePays = [],
  billingHistory = [],
  tickets = [],
  finalPending = false,
  onClose,
  onStatusAction,
  onConfirmFinal,
  onStartDeposit,
  onConfirmDeposit,
  onCancelManaged,
  onSaveDevFee,
  onSaveNote,
  onMarkOtpPaid,
  onMarkBillingPaid,
  onTicketUpdate,
  onTicketAddMessage,
  onTicketRead,
  ticketMessages = {},
  ticketQuotes = {},
  onSendQuote,
  onCancelQuote,
  staff,
  onGoCustomer,
  onSave,
  onDelete,
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => emptyEdit(site))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [fee, setFee] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    setEditing(false)
    setForm(emptyEdit(site))
    setMsg('')
  }, [site.site_id])

  useEffect(() => {
    setFee(inquiry?.dev_fee_total ? String(inquiry.dev_fee_total) : '')
    setNote(inquiry?.admin_note || '')
  }, [inquiry?.inquiry_id, inquiry?.dev_fee_total, inquiry?.admin_note])

  if (!site) return null

  const isManaged = site.build_type === 'managed'
  const otpLatest = oneTimePays.find(p => p.type === 'dev_fee') || null
  const money = moneyLabel(inquiry, otpLatest)
  const period = getSitePeriodInfo(site)
  const trialEnds = site.trial_ends_at ? new Date(site.trial_ends_at) : null
  const daysLeft = period.daysLeft

  const flowStep = isManaged
    ? resolveManagedFlowStep(inquiry, { site, subscription, finalPending })
    : resolveSelfFlowStep(site, { subscription })
  const hq = isManaged
    ? resolveHqInquiryAction(flowStep, inquiry, { linkedSite: site, finalPending })
    : { key: 'open_editor', label: '에디터 열기', hint: flowStepDesc(flowStep) || '고객 직접 제작 — 에디터는 참고용으로 열 수 있습니다.' }

  let flowTitle = '진행 상태'
  let flowHint = flowStepDesc(flowStep) || ''
  const stepCodes = isManaged ? FLOW_STEPS.filter(s => s !== 'suspended') : SELF_FLOW_STEPS.filter(s => s !== 'suspended')
  const steps = stepCodes.map(code => ({
    key: code,
    label: codeLabel('FLOW_STEP', code, flowStepLabel(code)),
  }))
  let stepIndex = getFlowStepIndex(flowStep, isManaged ? 'managed' : 'self')
  // suspended는 필터에서 빠지므로 마지막 표시 인덱스로
  if (flowStep === 'suspended') stepIndex = steps.length - 1
  else stepIndex = Math.min(stepIndex, steps.length - 1)

  if (isManaged) {
    flowTitle = inquiry ? '본사 대리 제작 흐름' : '본사 대리 (문의 미연결)'
    if (!inquiry) {
      flowHint = 'sites.inquiry_id 가 없거나 문의를 찾을 수 없습니다.'
      stepIndex = -1
    }
  } else {
    flowTitle = '고객 직접 제작 흐름'
  }

  function openEditor() {
    if (!site.subdomain) return
    window.open(siteAdminPath(site.subdomain, '/editor'), '_blank')
  }

  function runHqPrimary() {
    const key = hq.key
    if (key === 'start_deposit' && inquiry) return onStartDeposit?.(inquiry.inquiry_id)
    if (key === 'confirm_deposit' && inquiry) return onConfirmDeposit?.(inquiry.inquiry_id)
    if (key === 'open_editor') return openEditor()
    if (key === 'open_preview') return onStatusAction?.(site.site_id, 'preview')
    if (key === 'confirm_balance' && inquiry) return onConfirmFinal?.(inquiry.inquiry_id)
    if (key === 'view_site') return openEditor()
    if (key === 'need_fee') document.getElementById('hq-dev-fee')?.focus()
  }

  // 대리: 선금 확인 전 에디터 숨김 · 라벨 없을 때 에디터로 대체하지 않음
  const canEditor = !!site.subdomain && canOpenHqEditor(site.build_type, flowStep)
  const editorIsPrimary = canEditor && (hq.key === 'open_editor' || hq.key === 'view_site')
  const primaryLabel = hq.label || (hq.key === 'need_fee' ? '견적 입력' : null)
  const showEditorSecondary = canEditor && !!primaryLabel && !editorIsPrimary

  const nextActions = []
  // 직접제작 배포는 사장님(에디터/admin)만 — 본사에서 status만 바꾸면 사고 위험
  if (['trial', 'subscribed', 'pay_method'].includes(site.status)) {
    nextActions.push({ label: '정지', color: '#dc2626', run: () => onStatusAction?.(site.site_id, 'suspended') })
  }
  if (site.status === 'suspended') {
    nextActions.push({
      label: '복구',
      color: '#2563eb',
      run: () => onStatusAction?.(
        site.site_id,
        isManaged && !site.trial_started_at ? 'preview' : (site.trial_started_at ? 'trial' : 'pay_method')
      ),
    })
  }
  if (site.customer_id && onGoCustomer) {
    nextActions.push({ label: '이 회원 보기', color: '#38bdf8', run: () => onGoCustomer(site.customer_id) })
  }

  const showCancel = isManaged && inquiry && canCancelManagedIntake(inquiry, site) && onCancelManaged

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>사이트 상세</div>
          <h3 style={{ margin: 0, fontSize: 18, color: '#f1f5f9', fontWeight: 800 }}>{site.name}</h3>
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {badge(codeColor('FLOW_STEP', flowStep), codeLabel('FLOW_STEP', flowStep, flowStepLabel(flowStep)))}
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

      {/* 지금 할 일 — 상세 진입 시 바로 보이게 */}
      <div style={{
        marginBottom: 16, padding: '12px 14px', borderRadius: 10,
        background: '#0f172a', border: '1px solid #334155',
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', marginBottom: 6, letterSpacing: 0.3 }}>
          지금 할 일
        </div>
        {(hq.hint || flowHint) && (
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
            {hq.hint || flowHint}
          </p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {primaryLabel && (
            <button
              type="button"
              onClick={runHqPrimary}
              style={{
                padding: '9px 14px', background: '#2563eb', color: 'white',
                border: 'none', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
              }}
            >
              {primaryLabel}
            </button>
          )}
          {showEditorSecondary && (
            <button
              type="button"
              onClick={openEditor}
              style={{
                padding: '9px 14px', background: 'transparent', color: '#93c5fd',
                border: '1px solid #3b82f6', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
              }}
            >
              에디터 열기
            </button>
          )}
          {showCancel && (
            <button
              type="button"
              onClick={() => onCancelManaged()}
              style={{
                padding: '9px 14px', background: 'transparent', color: '#fca5a5',
                border: '1px solid #7f1d1d', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
              }}
            >
              접수 취소
            </button>
          )}
        </div>
      </div>

      <Section title={flowTitle}>
        {stepIndex >= 0 && <Stepper steps={steps} currentIndex={stepIndex} />}
        {flowHint && (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
            {flowHint}
          </p>
        )}
      </Section>

      {isManaged && inquiry && (
        <Section title="제작 의뢰">
          {inquiry.description && (
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, borderLeft: '2px solid #334155', paddingLeft: 10 }}>
              {inquiry.description}
            </p>
          )}
          <Row label="업종 · 연락처">
            {codeLabel('BUSINESS_TYPE', inquiry.business_type, inquiry.business_type || '—')} · {inquiry.phone || site.customers?.phone || '—'}
          </Row>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1e293b', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#64748b', flexShrink: 0 }}>총 개발비(견적)</span>
            <input id="hq-dev-fee" type="number" value={fee} onChange={e => setFee(e.target.value)} placeholder="금액"
              disabled={!!inquiry.down_paid_at}
              style={{ ...inputStyle, width: 120, padding: '4px 8px', marginLeft: 'auto' }} />
            <span style={{ fontSize: 12, color: '#64748b' }}>원</span>
            {!inquiry.down_paid_at && (
              <button type="button" onClick={() => onSaveDevFee?.(inquiry.inquiry_id, fee)}
                style={{ ...{ padding: '5px 10px', fontSize: 12, fontWeight: 700, borderRadius: 6, cursor: 'pointer', border: 'none', color: 'white', background: '#16a34a' }, background: '#334155' }}>저장</button>
            )}
          </div>
          {money && (
            <>
              <Row label="선금 50%">
                {inquiry.down_paid_at
                  ? `✓ ${new Date(inquiry.down_paid_at).toLocaleDateString('ko-KR')} · ${money.half.toLocaleString()}원`
                  : `${money.half.toLocaleString()}원 · 미확인`}
              </Row>
              <Row label="잔금 50%">
                {inquiry.final_paid_at
                  ? `✓ ${new Date(inquiry.final_paid_at).toLocaleDateString('ko-KR')} · ${money.half.toLocaleString()}원`
                  : `${money.half.toLocaleString()}원 · ${money.final}`}
              </Row>
            </>
          )}
          <div style={{ marginTop: 8 }}>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="직원 메모 — 상담·합의 내용"
              style={{ ...inputStyle, resize: 'vertical' }} />
            <button type="button" onClick={() => onSaveNote?.(inquiry.inquiry_id, note)}
              style={{ ...{ padding: '5px 10px', fontSize: 12, fontWeight: 700, borderRadius: 6, cursor: 'pointer', border: 'none', color: 'white', background: '#16a34a' }, background: '#334155', marginTop: 6 }}>메모 저장</button>
          </div>
        </Section>
      )}

      <Section title="1회성 결제">
        {oneTimePays.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>내역 없음</p>
        ) : oneTimePays.map(p => (
          <div key={p.payment_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #1e293b', fontSize: 12 }}>
            {badge(codeColor('OTP_TYPE', p.type), codeLabel('OTP_TYPE', p.type))}
            <span style={{ color: '#e2e8f0' }}>{p.amount?.toLocaleString()}원</span>
            <span style={{ color: '#64748b', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.note || ''}</span>
            {badge(codeColor('OTP_STATUS', p.status), codeLabel('OTP_STATUS', p.status))}
            {p.status !== 'paid' && (
              <button type="button" onClick={() => onMarkOtpPaid?.(p.payment_id)} style={{ padding: '5px 10px', fontSize: 12, fontWeight: 700, borderRadius: 6, cursor: 'pointer', border: 'none', color: 'white', background: '#16a34a' }}>납부확인</button>
            )}
          </div>
        ))}
      </Section>

      <Section title="구독 · 청구">
        {subscription ? (
          <>
            <Row label="상태">
              {subscriptionLifeLabel(site, subscription)}
              {subscription.cancels_at ? ` · 종료 ${new Date(subscription.cancels_at).toLocaleDateString('ko-KR')}` : ''}
            </Row>
            <Row label="요금 · 결제방식">
              {subscription.amount?.toLocaleString()}원/월 · {codeLabel('PAYMENT_METHOD', subscription.payment_method, subscription.payment_method || '—')}
            </Row>
            <Row label="다음 청구일">{subscription.next_billing_date || '—'}</Row>
            <Row label="기간">
              <span style={{ color: period.color, fontWeight: 700 }}>{period.label}</span>
              {period.subLabel ? ` · ${period.subLabel}` : ''}
              {site.trial_started_at && trialEnds ? ` · 체험 종료 ${trialEnds.toLocaleDateString('ko-KR')} (D-${daysLeft ?? '?'})` : ''}
            </Row>
            <div style={{ marginTop: 8 }}>
              {billingHistory.length === 0 && <p style={{ margin: '0 0 6px', fontSize: 12, color: '#64748b' }}>청구 이력 없음</p>}
              {billingHistory.map(bh => (
                <div key={bh.billing_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #1e293b', fontSize: 12 }}>
                  <span style={{ fontFamily: 'ui-monospace, Consolas, monospace', color: '#e2e8f0' }}>{bh.period}</span>
                  <span style={{ color: '#94a3b8' }}>{bh.amount?.toLocaleString()}원</span>
                  <span style={{ color: '#64748b', flex: 1 }}>
                    {codeLabel('PAYMENT_METHOD', bh.payment_method)}{bh.paid_at ? ` · ${new Date(bh.paid_at).toLocaleDateString('ko-KR')}` : ''}
                  </span>
                  {badge(codeColor('BILLING_STATUS', bh.status), codeLabel('BILLING_STATUS', bh.status))}
                  {bh.status !== 'paid' && (
                    <button type="button" onClick={() => onMarkBillingPaid?.(subscription, bh.amount, bh.period, bh.payment_method)} style={{ padding: '5px 10px', fontSize: 12, fontWeight: 700, borderRadius: 6, cursor: 'pointer', border: 'none', color: 'white', background: '#16a34a' }}>납부 확인</button>
                  )}
                </div>
              ))}
              {(() => {
                const cur = new Date().toISOString().slice(0, 7)
                if (billingHistory.some(bh => bh.period === cur)) return null
                return (
                  <button type="button" onClick={() => onMarkBillingPaid?.(subscription, subscription.amount, cur, subscription.payment_method)}
                    style={{ ...{ padding: '5px 10px', fontSize: 12, fontWeight: 700, borderRadius: 6, cursor: 'pointer', border: 'none', color: 'white', background: '#16a34a' }, background: '#2563eb', marginTop: 8 }}>+ {cur} 납부 확인</button>
                )
              })()}
            </div>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            구독 없음 — 서비스 시작(체험) 시 생성됩니다
          </p>
        )}
      </Section>

      <Section title={`고객 요청 ${tickets.filter(t => t.status !== 'resolved').length ? `(미처리 ${tickets.filter(t => t.status !== 'resolved').length})` : ''}`}>
        {tickets.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>요청 없음</p>
        ) : tickets.map(t => (
          <PlatformTicketCard
            key={t.ticket_id}
            ticket={t}
            messages={ticketMessages[t.ticket_id] || []}
            quote={ticketQuotes[t.ticket_id] || null}
            staff={staff}
            subdomain={site.subdomain}
            onUpdate={onTicketUpdate}
            onAddMessage={onTicketAddMessage}
            onRead={onTicketRead}
            onSendQuote={onSendQuote}
            onCancelQuote={onCancelQuote}
            onMarkQuotePaid={onMarkOtpPaid}
          />
        ))}
      </Section>

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

      <Section title="기타 액션">
        {!isManaged && site.status === 'building' && (
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
            직접제작 — 배포는 사장님이 사이트 관리/에디터에서 합니다. 본사에서 강제 배포하지 않습니다.
          </p>
        )}
        {nextActions.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>추가 액션 없음</p>
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
            {field('status', 'sites.status (FLOW_STEP)', { type: 'select', options: FLOW_STATUS_OPTS, codeGroup: 'FLOW_STEP' })}
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
