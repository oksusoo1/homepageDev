'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { USE_FLAG_OFF } from '@/lib/use-flag'
import { loadCommonCodes, codeLabel, codesInGroup } from '@/lib/common-codes'

/** 개발용: 한글라벨 (code) — 캐시 없으면 code만 */
function devOpt(group, code) {
  const label = codeLabel(group, code)
  return label === String(code) ? code : `${label} (${code})`
}

function opts(group, fallbackCodes) {
  const fromDb = codesInGroup(group).map(c => c.code)
  const codes = fromDb.length ? fromDb : fallbackCodes
  return codes.map(code => ({ value: code, label: devOpt(group, code) }))
}

const FALLBACK = {
  SITE_STATUS: ['draft', 'review', 'published', 'suspended', 'cancelled'],
  DEPLOY_STATUS: ['pending', 'building', 'live', 'failed'],
  INQUIRY_STATUS: ['received', 'reviewing', 'building', 'review', 'approved', 'done'],
  SUB_STATUS: ['pending', 'trial', 'active', 'paused', 'cancelled'],
  OTP_STATUS: ['unpaid', 'pending_confirm', 'paid'],
}
const selectStyle = {
  width: '100%', padding: '8px 10px', background: '#0f172a', color: '#e2e8f0',
  border: '1px solid #334155', borderRadius: 7, fontSize: 13, cursor: 'pointer',
}

const cardStyle = {
  background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 20, marginBottom: 16,
}

const mono = { fontFamily: 'ui-monospace, Consolas, monospace' }

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 5, ...mono }}>{label}</div>
      {children}
    </div>
  )
}

function Hint({ children }) {
  return (
    <div style={{
      marginTop: 6, marginBottom: 12, fontSize: 11, color: '#94a3b8',
      ...mono, lineHeight: 1.55, background: '#0a0a0f', borderRadius: 6,
      padding: '8px 10px', border: '1px solid #1e293b', whiteSpace: 'pre-line',
    }}>
      {children}
    </div>
  )
}

function Cur({ name, value }) {
  const v = value === null || value === undefined || value === '' ? 'NULL' : String(value)
  return (
    <span style={{ color: '#64748b' }}>
      {' '}(현재 <span style={{ color: '#fbbf24' }}>{name}</span>=
      <span style={{ color: '#e2e8f0' }}>{v.length > 24 ? v.slice(0, 24) + '…' : v}</span>)
    </span>
  )
}

/**
 * 개발/테스트용 상태 되돌리기 패널 (관리자 전용)
 */
export default function PlatformDevTools({ sites, inquiries, subscriptions, oneTimePays, onRefresh }) {
  const [siteId, setSiteId] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [asOfOffset, setAsOfOffset] = useState(0)
  const [batchLog, setBatchLog] = useState('')
  const [codesTick, setCodesTick] = useState(0)

  useEffect(() => {
    if (!siteId && sites[0]) setSiteId(sites[0].site_id)
  }, [sites, siteId])

  useEffect(() => {
    loadCommonCodes()
      .then(() => setCodesTick(t => t + 1))
      .catch(() => {})
  }, [])

  const site = sites.find(s => s.site_id === siteId) || null
  void codesTick // 공통코드 로드 후 옵션 라벨 재렌더
  const inquiry = site?.inquiry_id
    ? inquiries.find(i => i.inquiry_id === site.inquiry_id)
    : inquiries.find(i => i.customer_id === site?.customer_id) || null
  const sub = subscriptions.find(s => s.site_id === siteId) || null
  const otps = oneTimePays.filter(p =>
    (p.use_flag === undefined || p.use_flag === 1) &&
    (p.site_id === siteId || (site && p.customer_id === site.customer_id && p.type === 'dev_fee'))
  )

  async function run(fn, okMsg) {
    setBusy(true)
    setMsg('')
    try {
      await fn()
      setMsg('✅ ' + okMsg)
      await onRefresh()
    } catch (e) {
      setMsg('❌ ' + (e.message || String(e)))
    }
    setBusy(false)
  }

  async function updateSite(patch) {
    const { error } = await supabase.from('sites').update({ ...patch, updated_at: new Date().toISOString() }).eq('site_id', siteId)
    if (error) throw error
  }

  async function updateInquiry(patch) {
    if (!inquiry) throw new Error('연결된 inquiries 행이 없습니다.')
    const { error } = await supabase.from('inquiries').update({ ...patch, updated_at: new Date().toISOString() }).eq('inquiry_id', inquiry.inquiry_id)
    if (error) throw error
  }

  async function updateSub(patch) {
    if (!sub) throw new Error('subscriptions 행이 없습니다.')
    const { error } = await supabase.from('subscriptions').update({ ...patch, updated_at: new Date().toISOString() }).eq('subscription_id', sub.subscription_id)
    if (error) throw error
  }

  async function deleteBillingThenSub() {
    if (!sub) return
    await supabase.from('billing_history').delete().eq('subscription_id', sub.subscription_id)
    const { error } = await supabase.from('subscriptions').delete().eq('subscription_id', sub.subscription_id)
    if (error) throw error
  }

  async function deleteDevFeeOtps() {
    for (const p of otps.filter(o => o.type === 'dev_fee')) {
      const { error } = await supabase.from('one_time_payments')
        .update({ use_flag: USE_FLAG_OFF })
        .eq('payment_id', p.payment_id)
      if (error) throw error
    }
  }

  async function rewindTo(step) {
    const now = new Date().toISOString()
    if (!site) throw new Error('사이트를 선택하세요.')

    if (step === 'preview') {
      await updateSite({ status: 'review', deploy_status: 'live', trial_started_at: null, trial_ends_at: null })
      if (inquiry) await updateInquiry({ status: 'review', final_paid_at: null })
      await deleteDevFeeOtps()
      await deleteBillingThenSub()
    }

    if (step === 'deposit_pending') {
      await updateSite({ status: 'review', deploy_status: 'live', trial_started_at: null, trial_ends_at: null })
      if (inquiry) await updateInquiry({ status: 'review', final_paid_at: null })
      const existing = otps.find(o => o.type === 'dev_fee')
      if (existing) {
        const { error } = await supabase.from('one_time_payments').update({
          status: 'pending_confirm',
          paid_at: null,
          note: existing.note || `잔금 입금 신청 · 입금자: ${site.customers?.name || ''}`,
        }).eq('payment_id', existing.payment_id)
        if (error) throw error
      } else if (inquiry) {
        const { error } = await supabase.from('one_time_payments').insert({
          customer_id: site.customer_id,
          site_id: site.site_id,
          type: 'dev_fee',
          amount: Math.floor((inquiry.dev_fee_total || 200000) / 2),
          status: 'pending_confirm',
          note: `잔금 입금 신청 · 입금자: ${site.customers?.name || ''}`,
        })
        if (error) throw error
      }
      await deleteBillingThenSub()
    }

    if (step === 'ready_golive') {
      await updateSite({ status: 'review', deploy_status: 'live', trial_started_at: null, trial_ends_at: null })
      if (inquiry) await updateInquiry({ status: 'approved', final_paid_at: now })
      const existing = otps.find(o => o.type === 'dev_fee')
      if (existing) {
        const { error } = await supabase.from('one_time_payments').update({ status: 'paid', paid_at: now }).eq('payment_id', existing.payment_id)
        if (error) throw error
      } else if (inquiry) {
        const { error } = await supabase.from('one_time_payments').insert({
          customer_id: site.customer_id,
          site_id: site.site_id,
          type: 'dev_fee',
          amount: Math.floor((inquiry.dev_fee_total || 200000) / 2),
          status: 'paid',
          paid_at: now,
          note: '잔금 확인 (테스트)',
        })
        if (error) throw error
      }
      await deleteBillingThenSub()
    }

    if (step === 'building') {
      await updateSite({ status: 'draft', deploy_status: 'pending', trial_started_at: null, trial_ends_at: null })
      if (inquiry) await updateInquiry({ status: 'building', final_paid_at: null })
      await deleteDevFeeOtps()
      await deleteBillingThenSub()
    }
  }

  const presets = [
    {
      key: 'building',
      title: '제작중',
      desc: '사이트 draft · 문의 building · 구독/잔금결제 없음',
      db: [
        'UPDATE sites SET status=draft, deploy_status=pending, trial_started_at=NULL, trial_ends_at=NULL',
        'UPDATE inquiries SET status=building, final_paid_at=NULL',
        'DELETE FROM one_time_payments WHERE type=dev_fee',
        'DELETE FROM subscriptions (+ billing_history)',
      ].join('\n'),
    },
    {
      key: 'preview',
      title: '미리보기·잔금',
      desc: '검수중, 고객이 잔금 결제하기 전',
      db: [
        'UPDATE sites SET status=review, deploy_status=live, trial_*=NULL',
        'UPDATE inquiries SET status=review, final_paid_at=NULL',
        'DELETE FROM one_time_payments WHERE type=dev_fee',
        'DELETE FROM subscriptions (+ billing_history)',
      ].join('\n'),
    },
    {
      key: 'deposit_pending',
      title: '입금확인대기',
      desc: '고객이 잔금 입금 신청한 직후',
      db: [
        'UPDATE sites SET status=review, deploy_status=live',
        'UPDATE inquiries SET status=review, final_paid_at=NULL',
        'UPSERT one_time_payments SET status=pending_confirm, paid_at=NULL',
        'DELETE FROM subscriptions (+ billing_history)',
      ].join('\n'),
    },
    {
      key: 'ready_golive',
      title: '서비스 시작 준비',
      desc: '잔금 확인 완료. 구독 등록 전',
      db: [
        'UPDATE sites SET status=review, deploy_status=live',
        'UPDATE inquiries SET status=approved, final_paid_at=NOW()',
        'UPSERT one_time_payments SET status=paid, paid_at=NOW()',
        'DELETE FROM subscriptions (+ billing_history)',
      ].join('\n'),
    },
  ]

  return (
    <div>
      <div style={{ ...cardStyle, border: '1px solid #f59e0b44', background: '#1a1408' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b', marginBottom: 8 }}>개발 전용 · 테이블 / 컬럼</div>
        <div style={{ fontSize: 11, color: '#94a3b8', ...mono, lineHeight: 1.7, whiteSpace: 'pre-line' }}>
{`sites                  status, deploy_status, trial_started_at, trial_ends_at
inquiries              status, down_paid_at, final_paid_at, dev_fee_total
subscriptions          status, payment_method, next_billing_date
one_time_payments      status, amount, paid_at, type, note
billing_history        (구독 삭제 시 함께 삭제)`}
        </div>
      </div>

      <div style={cardStyle}>
        <Field label="사이트 선택">
          <select value={siteId} onChange={e => { setSiteId(e.target.value); setMsg('') }} style={selectStyle}>
            <option value="">— 선택 —</option>
            {sites.map(s => (
              <option key={s.site_id} value={s.site_id}>
                {s.name} ({s.subdomain}) · {devOpt('BUILD_TYPE', s.build_type)} · {devOpt('SITE_STATUS', s.status)}
              </option>
            ))}
          </select>
        </Field>
        {site && (
          <div style={{ fontSize: 11, color: '#64748b', ...mono }}>
            sites.site_id={site.site_id.slice(0, 8)}… · sites.customer_id={site.customer_id?.slice(0, 8)}…
            {site.inquiry_id ? ` · sites.inquiry_id=${site.inquiry_id.slice(0, 8)}…` : ' · sites.inquiry_id=NULL'}
            <br />고객 {site.customers?.name} ({site.customers?.email})
          </div>
        )}
      </div>

      {site && (
        <>
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#f1f5f9' }}>자주 쓰는 되돌리기</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {presets.map(p => (
                <button
                  key={p.key}
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`「${p.title}」\n\n${p.db}`)) return
                    run(() => rewindTo(p.key), `${p.title} 적용`)
                  }}
                  style={{
                    textAlign: 'left', padding: '14px 16px', background: '#0f172a',
                    border: '1px solid #334155', borderRadius: 10, cursor: busy ? 'default' : 'pointer', color: '#e2e8f0',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4, marginBottom: 8 }}>{p.desc}</div>
                  <div style={{ fontSize: 10, color: '#64748b', ...mono, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{p.db}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14, color: '#f1f5f9' }}>
              테이블 <span style={{ color: '#60a5fa' }}>sites</span>
            </h3>
            <Hint>{`sites.status → 검수/운영/정지
sites.deploy_status → URL 배포 여부
sites.trial_started_at / sites.trial_ends_at → 체험`}</Hint>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label={<>sites.status<Cur name="status" value={site.status} /></>}>
                <select value={site.status} onChange={e => run(() => updateSite({ status: e.target.value }), 'UPDATE sites.status')} style={selectStyle}>
                  {opts('SITE_STATUS', FALLBACK.SITE_STATUS).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label={<>sites.deploy_status<Cur name="deploy_status" value={site.deploy_status} /></>}>
                <select value={site.deploy_status} onChange={e => run(() => updateSite({ deploy_status: e.target.value }), 'UPDATE sites.deploy_status')} style={selectStyle}>
                  {opts('DEPLOY_STATUS', FALLBACK.DEPLOY_STATUS).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
            <button
              disabled={busy}
              onClick={() => run(() => updateSite({ trial_started_at: null, trial_ends_at: null }), 'UPDATE sites.trial_started_at, trial_ends_at = NULL')}
              style={ghostBtn}
            >
              UPDATE sites SET trial_started_at=NULL, trial_ends_at=NULL
            </button>
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14, color: '#f1f5f9' }}>
              테이블 <span style={{ color: '#60a5fa' }}>inquiries</span> {inquiry ? '' : '(없음)'}
            </h3>
            <Hint>{`inquiries.status → /my 진행 단계
inquiries.down_paid_at → 선금 확인일
inquiries.final_paid_at → 잔금 확인일 (/my 「남은 잔금 완료」)
inquiries.dev_fee_total → 총 개발비`}</Hint>
            {inquiry ? (
              <>
                <Field label={<>inquiries.status<Cur name="status" value={inquiry.status} /></>}>
                  <select
                    value={inquiry.status}
                    onChange={e => {
                      const next = e.target.value
                      const patch = { status: next }
                      if (['received', 'reviewing', 'building', 'review'].includes(next)) patch.final_paid_at = null
                      run(() => updateInquiry(patch), 'UPDATE inquiries.status (+ final_paid_at)')
                    }}
                    style={selectStyle}
                  >
                    {opts('INQUIRY_STATUS', FALLBACK.INQUIRY_STATUS).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, ...mono }}>
                  inquiries.down_paid_at = {inquiry.down_paid_at || 'NULL'}
                  {' · '}
                  inquiries.final_paid_at = {inquiry.final_paid_at || 'NULL'}
                  {' · '}
                  inquiries.dev_fee_total = {inquiry.dev_fee_total ?? 'NULL'}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button disabled={busy} onClick={() => run(() => updateInquiry({ down_paid_at: null }), 'UPDATE inquiries.down_paid_at=NULL')} style={ghostBtn}>
                    UPDATE inquiries.down_paid_at = NULL
                  </button>
                  <button disabled={busy} onClick={() => run(() => updateInquiry({ final_paid_at: null, status: 'review' }), 'UPDATE inquiries.final_paid_at=NULL, status=review')} style={ghostBtn}>
                    UPDATE inquiries.final_paid_at = NULL
                  </button>
                </div>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>연결된 inquiries 행이 없습니다.</p>
            )}
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14, color: '#f1f5f9' }}>
              테이블 <span style={{ color: '#60a5fa' }}>subscriptions</span> {sub ? '' : '(없음)'}
            </h3>
            <Hint>{`subscriptions.status → trial / active / paused / cancelled
DELETE 시 billing_history 도 함께 삭제`}</Hint>
            {sub ? (
              <>
                <Field label={<>subscriptions.status<Cur name="status" value={sub.status} /></>}>
                  <select value={sub.status} onChange={e => run(() => updateSub({ status: e.target.value }), 'UPDATE subscriptions.status')} style={selectStyle}>
                    {opts('SUB_STATUS', FALLBACK.SUB_STATUS).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm('DELETE billing_history + subscriptions ?')) return
                    run(() => deleteBillingThenSub(), 'DELETE subscriptions')
                  }}
                  style={{ ...ghostBtn, color: '#fca5a5', borderColor: '#7f1d1d' }}
                >
                  DELETE subscriptions (+ billing_history)
                </button>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>subscriptions 행 없음 (검수 단계 정상)</p>
            )}
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14, color: '#f1f5f9' }}>
              테이블 <span style={{ color: '#60a5fa' }}>one_time_payments</span>
            </h3>
            <Hint>{`one_time_payments.status → unpaid | pending_confirm | paid
one_time_payments.amount → 청구금액
one_time_payments.paid_at → 납부확인일
테스트로 꼬인 행은 아래 DELETE 로 지우면 됨`}</Hint>
            {otps.length > 0 && (
              <button
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(
                    `DELETE FROM one_time_payments\nWHERE type=dev_fee (이 사이트/고객)\n\n${otps.length}행을 모두 삭제할까요?`
                  )) return
                  run(() => deleteDevFeeOtps(), `DELETE one_time_payments × ${otps.length}`)
                }}
                style={{ ...ghostBtn, color: '#fca5a5', borderColor: '#7f1d1d', marginBottom: 14 }}
              >
                DELETE ALL · type=dev_fee ({otps.length}행)
              </button>
            )}
            {otps.length === 0 && <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>행 없음 (잔금 결제 전 정상)</p>}
            {otps.map(p => (
              <div key={p.payment_id} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #1e293b' }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, ...mono }}>
                  payment_id={p.payment_id.slice(0, 8)}… · type={p.type} · amount={p.amount} · paid_at={p.paid_at || 'NULL'}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <Field label="one_time_payments.status">
                      <select
                        value={p.status}
                        onChange={e => run(async () => {
                          const next = e.target.value
                          const { error } = await supabase.from('one_time_payments').update({
                            status: next,
                            paid_at: next === 'paid' ? new Date().toISOString() : null,
                          }).eq('payment_id', p.payment_id)
                          if (error) throw error
                        }, 'UPDATE one_time_payments.status')}
                        style={selectStyle}
                      >
                        {opts('OTP_STATUS', FALLBACK.OTP_STATUS).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </Field>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`SOFT DELETE one_time_payments\nWHERE payment_id=${p.payment_id}\n(use_flag=0)`)) return
                      run(async () => {
                        const { error } = await supabase.from('one_time_payments')
                          .update({ use_flag: USE_FLAG_OFF })
                          .eq('payment_id', p.payment_id)
                        if (error) throw error
                      }, 'SOFT DELETE one_time_payments (use_flag=0)')
                    }}
                    style={{ ...ghostBtn, color: '#fca5a5', borderColor: '#7f1d1d', marginBottom: 12 }}
                  >
                    DELETE 이 행
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 청구 배치 목업 */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', marginBottom: 8, ...mono }}>
          청구 배치 (목업) · 수동 실행만 · cron 미연결
        </div>
        <Hint>
          {`카드: next_billing_date 다음날 → billing_history paid + active
계좌: D-5~D-day 알림톡 로그 / 미납+2일 → suspended
POST /api/cron/billing  { "asOf": "YYYY-MM-DD" }`}
        </Hint>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
          <div style={{ minWidth: 160 }}>
            <Field label="가상 오늘 = 실제오늘 + N일">
              <input
                type="number"
                value={asOfOffset}
                onChange={e => setAsOfOffset(Number(e.target.value) || 0)}
                style={{ ...selectStyle, cursor: 'text' }}
              />
            </Field>
          </div>
          <button
            disabled={busy}
            onClick={() => run(async () => {
              const base = new Date()
              base.setDate(base.getDate() + asOfOffset)
              const y = base.getFullYear()
              const m = String(base.getMonth() + 1).padStart(2, '0')
              const d = String(base.getDate()).padStart(2, '0')
              const asOf = `${y}-${m}-${d}`
              const res = await fetch('/api/cron/billing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ asOf }),
              })
              const json = await res.json()
              if (!res.ok || !json.ok) throw new Error(json.error || '배치 실패')
              setBatchLog(JSON.stringify(json, null, 2))
            }, `청구 배치 실행 (asOf=오늘+${asOfOffset}일)`)}
            style={{
              padding: '10px 18px', background: '#f59e0b', color: '#1c1917',
              border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 13,
              cursor: busy ? 'default' : 'pointer', marginBottom: 12, ...mono,
            }}
          >
            청구 배치 실행
          </button>
        </div>
        {batchLog && (
          <pre style={{
            margin: 0, padding: 12, background: '#0a0a0f', borderRadius: 8,
            border: '1px solid #1e293b', color: '#94a3b8', fontSize: 11,
            overflow: 'auto', maxHeight: 280, ...mono,
          }}>
            {batchLog}
          </pre>
        )}
      </div>

      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, fontSize: 13, ...mono,
          background: msg.startsWith('✅') ? '#052e16' : '#450a0a',
          color: msg.startsWith('✅') ? '#86efac' : '#fca5a5',
          whiteSpace: 'pre-wrap',
        }}>
          {msg}
        </div>
      )}
    </div>
  )
}

const ghostBtn = {
  padding: '8px 14px', background: 'transparent', color: '#94a3b8',
  border: '1px solid #334155', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 600,
  fontFamily: 'ui-monospace, Consolas, monospace',
}
