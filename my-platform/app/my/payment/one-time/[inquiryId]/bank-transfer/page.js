'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { loadOwnerInquiryPaymentAction } from '@/app/my/actions'
import { getBankAccountText } from '@/lib/payment/common'
import {
  getStageAmount,
  stageMeta,
} from '@/lib/payment/one-time'
import { requestStageBankConfirmAction } from '@/app/my/actions'
import { oneTimePaymentMethodPath } from '@/lib/payment/paths'
import DevFeeSummary from '@/components/DevFeeSummary'
import PaymentResultPanel from '@/components/PaymentResultPanel'

function BankTransferPageInner() {
  const router = useRouter()
  const params = useParams()
  const inquiryId = params.inquiryId
  const searchParams = useSearchParams()
  const stage = searchParams.get('stage') === 'down' ? 'down' : 'final'
  const meta = stageMeta(stage)
  const [inquiry, setInquiry] = useState(null)
  const [depositorName, setDepositorName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const bankAccount = getBankAccountText()

  useEffect(() => { init() }, [inquiryId, stage])

  async function init() {
    const result = await loadOwnerInquiryPaymentAction(inquiryId, stage)
    if (!result.ok) {
      setBlocked(result.error)
      setLoading(false)
      return
    }

    setInquiry(result.data.inquiry)
    setDepositorName(result.data.customerName || '')
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!agreed) { setError('안내 사항에 동의해 주세요.'); return }

    setSubmitting(true)
    const res = await requestStageBankConfirmAction(inquiryId, { depositorName, stage })
    setSubmitting(false)

    if (!res.ok) {
      setError(res.error)
      return
    }

    setSubmitted(true)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f7f4' }}>
        <div style={{ color: '#9ca3af', fontSize: 14 }}>로딩 중...</div>
      </div>
    )
  }

  const amount = getStageAmount(inquiry)

  if (blocked) {
    return (
      <PaymentResultPanel
        kind="error"
        title="지금은 결제할 수 없습니다"
        message={blocked}
        hint="진행 상황은 내 사이트에서 확인하실 수 있습니다."
      />
    )
  }

  if (submitted) {
    return (
      <PaymentResultPanel
        title={`${meta.label} 입금 확인을 요청했습니다`}
        message={`${amount?.toLocaleString()}원 · 입금자명 ${depositorName}`}
        hint={`본사에서 입금을 확인하면(1~2영업일) ${meta.nextHint} 진행 상황은 내 사이트에서 볼 수 있습니다.`}
      />
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f7f4', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 20, fontFamily: '-apple-system, "Malgun Gothic", sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <DevFeeSummary inquiry={inquiry} highlight={stage} />
        <div style={{ marginTop: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>{meta.label} 계좌이체</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
            지금 입금할 금액 <strong style={{ color: '#b45309' }}>{amount?.toLocaleString()}원</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: 'white', borderRadius: 16, padding: '28px 24px', border: '1px solid #e5e7eb' }}>
          <div style={{ background: '#f9fafb', borderRadius: 10, padding: '16px 18px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>입금 계좌</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{bankAccount}</div>
          </div>

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>입금자명</label>
          <input
            data-testid="otp-depositor"
            value={depositorName}
            onChange={e => setDepositorName(e.target.value)}
            required
            style={{
              width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb',
              borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 16,
            }}
          />

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#6b7280', marginBottom: 20, cursor: 'pointer' }}>
            <input type="checkbox" data-testid="otp-agree" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 3 }} />
            <span>위 계좌로 입금했으며, 본사 확인 전에는 다음 단계로 넘어가지 않음을 이해합니다.</span>
          </label>

          {error && (
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#dc2626' }}>{error}</p>
          )}

          <button
            type="submit"
            data-testid="otp-submit"
            disabled={submitting}
            style={{
              width: '100%', padding: '14px 0', background: submitting ? '#9ca3af' : '#111827',
              color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
              cursor: submitting ? 'default' : 'pointer',
            }}
          >
            {submitting ? '처리 중...' : '입금했어요 · 확인 요청'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13 }}>
          <Link href={oneTimePaymentMethodPath(inquiryId, stage)} style={{ color: '#6b7280' }}>← 다른 결제 수단</Link>
        </p>
        </div>
      </div>
    </div>
  )
}

export default function OneTimePaymentBankTransferPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩...</div>}>
      <BankTransferPageInner />
    </Suspense>
  )
}
