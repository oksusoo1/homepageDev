'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { loadOwnerInquiryPaymentAction } from '@/app/my/actions'
import {
  getStageAmount,
  stageMeta,
} from '@/lib/payment/one-time'
import { payStageCardMockAction } from '@/app/my/actions'
import { oneTimePaymentMethodPath } from '@/lib/payment/paths'
import DevFeeSummary from '@/components/DevFeeSummary'
import PaymentResultPanel from '@/components/PaymentResultPanel'

function CardPageInner() {
  const router = useRouter()
  const params = useParams()
  const inquiryId = params.inquiryId
  const searchParams = useSearchParams()
  const stage = searchParams.get('stage') === 'down' ? 'down' : 'final'
  const meta = stageMeta(stage)
  const [inquiry, setInquiry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [blocked, setBlocked] = useState('')
  const [paid, setPaid] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { init() }, [inquiryId, stage])

  async function init() {
    const result = await loadOwnerInquiryPaymentAction(inquiryId, stage)
    if (!result.ok) {
      setBlocked(result.error)
      setLoading(false)
      return
    }
    setInquiry(result.data.inquiry)
    setLoading(false)
  }

  async function handleMockPay() {
    setError('')
    setSubmitting(true)
    const res = await payStageCardMockAction(inquiryId, { stage })
    setSubmitting(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setPaid(true)
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

  if (paid) {
    return (
      <PaymentResultPanel
        title={`${meta.label} 결제가 완료되었습니다`}
        message={`${amount?.toLocaleString()}원 결제 완료`}
        hint={meta.nextHint}
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
        <div style={{ background: 'white', borderRadius: 16, padding: '32px 28px', border: '1px solid #e5e7eb', marginTop: 16 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>카드 결제 (목업)</h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
          지금 납부할 {meta.label} <strong style={{ color: '#b45309' }}>{amount?.toLocaleString()}원</strong>
        </p>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>
          실서비스 전환 시 토스페이먼츠 1회 결제로 연동됩니다.
        </p>
        {error && <p style={{ margin: '0 0 12px', fontSize: 13, color: '#dc2626' }}>{error}</p>}
        <button
          type="button"
          onClick={handleMockPay}
          disabled={submitting}
          style={{
            width: '100%', padding: '14px 0', background: submitting ? '#9ca3af' : '#111827',
            color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
            cursor: submitting ? 'default' : 'pointer', marginBottom: 16,
          }}
        >
          {submitting ? '처리 중...' : `${amount?.toLocaleString()}원 결제하기 (목업)`}
        </button>
        <p style={{ textAlign: 'center', margin: 0, fontSize: 13 }}>
          <Link href={oneTimePaymentMethodPath(inquiryId, stage)} style={{ color: '#6b7280' }}>← 다른 결제 수단</Link>
        </p>
        </div>
      </div>
    </div>
  )
}

export default function OneTimePaymentCardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩...</div>}>
      <CardPageInner />
    </Suspense>
  )
}
