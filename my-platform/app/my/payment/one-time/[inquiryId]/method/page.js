'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PaymentMethodChooser from '@/components/PaymentMethodChooser'
import DevFeeSummary from '@/components/DevFeeSummary'
import {
  getFinalPaymentAmount,
  loadInquiryForPayment,
} from '@/lib/payment/one-time'
import {
  oneTimePaymentBankTransferPath,
  oneTimePaymentCardPath,
} from '@/lib/payment/paths'

function MethodPageInner() {
  const router = useRouter()
  const params = useParams()
  const inquiryId = params.inquiryId
  const [inquiry, setInquiry] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { init() }, [inquiryId])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: cust } = await supabase.from('customers').select('customer_id').eq('auth_id', user.id).single()
    if (!cust) { router.push('/login'); return }

    const result = await loadInquiryForPayment(supabase, inquiryId, cust.customer_id)
    if (!result.ok) {
      alert(result.error)
      router.push('/my')
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

  const amount = getFinalPaymentAmount(inquiry)

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f7f4', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 20, fontFamily: '-apple-system, "Malgun Gothic", sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <DevFeeSummary inquiry={inquiry} highlight="final" />
        <div style={{ marginTop: 16 }}>
          <PaymentMethodChooser
            embedded
            title="잔금 결제"
            subtitle={`지금 납부할 금액 ${amount?.toLocaleString()}원`}
            cardHref={oneTimePaymentCardPath(inquiryId)}
            cardTitle="카드 결제"
            cardDesc="카드로 잔금을 결제합니다 (목업)"
            bankHref={oneTimePaymentBankTransferPath(inquiryId)}
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
