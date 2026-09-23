'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { requireAuthUser } from '@/lib/auth'
import PaymentMethodChooser from '@/components/PaymentMethodChooser'
import PaymentResultPanel from '@/components/PaymentResultPanel'
import DevFeeSummary from '@/components/DevFeeSummary'
import {
  getStageAmount,
  loadInquiryForPayment,
  stageMeta,
} from '@/lib/payment/one-time'
import {
  oneTimePaymentBankTransferPath,
  oneTimePaymentCardPath,
} from '@/lib/payment/paths'

function MethodPageInner() {
  const router = useRouter()
  const params = useParams()
  const inquiryId = params.inquiryId
  const searchParams = useSearchParams()
  const stage = searchParams.get('stage') === 'down' ? 'down' : 'final'
  const meta = stageMeta(stage)
  const [inquiry, setInquiry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState('')

  useEffect(() => { init() }, [inquiryId, stage])

  async function init() {
    const user = await requireAuthUser()
    if (!user) { router.push('/login'); return }

    const { data: cust } = await supabase.from('customers').select('customer_id').eq('auth_id', user.id).single()
    if (!cust) { router.push('/login'); return }

    const result = await loadInquiryForPayment(supabase, inquiryId, cust.customer_id, stage)
    if (!result.ok) {
      setBlocked(result.error)
      setLoading(false)
      return
    }

    setInquiry(result.inquiry)
    setLoading(false)
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

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f7f4', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 20, fontFamily: '-apple-system, "Malgun Gothic", sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <DevFeeSummary inquiry={inquiry} highlight={stage} />
        <div style={{ marginTop: 16 }}>
          <PaymentMethodChooser
            embedded
            title={`${meta.label} 결제`}
            subtitle={`지금 납부할 금액 ${amount?.toLocaleString()}원`}
            cardHref={oneTimePaymentCardPath(inquiryId, stage)}
            cardTitle="카드 결제"
            cardDesc={`카드로 ${meta.label}을 결제합니다 (목업)`}
            bankHref={oneTimePaymentBankTransferPath(inquiryId, stage)}
            bankTitle="계좌이체"
            bankDesc="입금 후 본사 확인 (1~2영업일)"
            backHref="/my"
            backLabel="← 내 사이트로"
          />
        </div>
      </div>
    </div>
  )
}

export default function OneTimePaymentMethodPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩...</div>}>
      <MethodPageInner />
    </Suspense>
  )
}
