'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { requireAuthUser } from '@/lib/auth'
import { loadQuote, payQuoteCardMock } from '@/lib/payment/extra'
import { siteAdminPath } from '@/lib/site-paths'
import PaymentResultPanel from '@/components/PaymentResultPanel'
import QuoteSummary from '@/components/QuoteSummary'

/** 추가 작업 견적 — 카드 결제 (목업) */
function Inner() {
  const router = useRouter()
  const { siteCode, paymentId } = useParams()
  const [quote, setQuote] = useState(null)
  const [blocked, setBlocked] = useState('')
  const [paid, setPaid] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { init() }, [paymentId])

  async function init() {
    const user = await requireAuthUser()
    if (!user) { router.push('/login'); return }
    const { data: cust } = await supabase.from('customers').select('customer_id').eq('auth_id', user.id).single()
    if (!cust) { router.push('/login'); return }

    const res = await loadQuote(supabase, paymentId, cust.customer_id)
    if (!res.ok) { setBlocked(res.error); setLoading(false); return }
    setQuote(res.quote)
    setLoading(false)
  }

  async function handlePay() {
    setError('')
    setSubmitting(true)
    const { error: err } = await payQuoteCardMock(supabase, { quote })
    setSubmitting(false)
    if (err) { setError(err); return }
    setPaid(true)
  }

  const back = `${siteAdminPath(siteCode)}?menu=support.requests`

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f7f4', color: '#9ca3af', fontSize: 14 }}>로딩 중...</div>
  }
  if (blocked) {
    return <PaymentResultPanel kind="error" title="지금은 결제할 수 없습니다" message={blocked} actionLabel="본사 요청으로" actionHref={back} />
  }
  if (paid) {
    return (
      <PaymentResultPanel
        title="결제가 완료되었습니다"
        message={`${quote.amount?.toLocaleString()}원 결제 완료`}
        hint="본사가 작업을 시작합니다. 진행 상황과 결과는 본사 요청에서 확인하실 수 있습니다."
        actionLabel="본사 요청으로"
        actionHref={back}
      />
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f7f4', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 20, fontFamily: '-apple-system, "Malgun Gothic", sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <QuoteSummary quote={quote} />
        <div style={{ background: 'white', borderRadius: 16, padding: '32px 28px', border: '1px solid #e5e7eb', marginTop: 16 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>카드 결제 (목업)</h1>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
            결제 금액 <strong style={{ color: '#b45309' }}>{quote.amount?.toLocaleString()}원</strong>
          </p>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>
            실서비스 전환 시 토스페이먼츠 1회 결제로 연동됩니다.
          </p>
          {error && <p style={{ margin: '0 0 12px', fontSize: 13, color: '#dc2626' }}>{error}</p>}
          <button type="button" onClick={handlePay} disabled={submitting} style={{
            width: '100%', padding: '14px 0', background: submitting ? '#9ca3af' : '#111827',
            color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
            cursor: submitting ? 'default' : 'pointer', marginBottom: 16,
          }}>
            {submitting ? '처리 중...' : `${quote.amount?.toLocaleString()}원 결제하기 (목업)`}
          </button>
          <p style={{ textAlign: 'center', margin: 0, fontSize: 13 }}>
            <Link href={`${siteAdminPath(siteCode)}/payment/one-time/${paymentId}/method`} style={{ color: '#6b7280' }}>← 다른 결제 수단</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function QuoteCardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
      <Inner />
    </Suspense>
  )
}
