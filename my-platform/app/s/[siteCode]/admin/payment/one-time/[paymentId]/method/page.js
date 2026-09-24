'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { requireAuthUser } from '@/lib/auth'
import PaymentMethodChooser from '@/components/PaymentMethodChooser'
import PaymentResultPanel from '@/components/PaymentResultPanel'
import QuoteSummary from '@/components/QuoteSummary'
import { loadQuote } from '@/lib/payment/extra'
import { siteAdminPath } from '@/lib/site-paths'

/** 추가 작업 견적 — 결제 수단 선택 */
function Inner() {
  const router = useRouter()
  const { siteCode, paymentId } = useParams()
  const [quote, setQuote] = useState(null)
  const [blocked, setBlocked] = useState('')
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

  const back = `${siteAdminPath(siteCode)}?menu=support.requests`

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f7f4', color: '#9ca3af', fontSize: 14 }}>로딩 중...</div>
  }
  if (blocked) {
    return (
      <PaymentResultPanel kind="error" title="지금은 결제할 수 없습니다" message={blocked}
        hint="진행 상황은 본사 요청에서 확인하실 수 있습니다." actionLabel="본사 요청으로" actionHref={back} />
    )
  }

  const base = `${siteAdminPath(siteCode)}/payment/one-time/${paymentId}`

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f7f4', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 20, fontFamily: '-apple-system, "Malgun Gothic", sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <QuoteSummary quote={quote} />
        <div style={{ marginTop: 16 }}>
          <PaymentMethodChooser
            embedded
            title="추가 작업 결제"
            subtitle={`결제 금액 ${quote.amount?.toLocaleString()}원`}
            cardHref={`${base}/card`}
            cardTitle="카드 결제"
            cardDesc="카드로 결제합니다 (목업)"
            bankHref={`${base}/bank-transfer`}
            bankTitle="계좌이체"
            bankDesc="입금 후 본사 확인 (1~2영업일)"
            backHref={back}
            backLabel="← 본사 요청으로"
          />
        </div>
      </div>
    </div>
  )
}

export default function QuoteMethodPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
      <Inner />
    </Suspense>
  )
}
