'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { requireAuthUser } from '@/lib/auth'
import {
  completeFinalPaymentCardMock,
  getFinalPaymentAmount,
  loadInquiryForPayment,
} from '@/lib/payment/one-time'
import { oneTimePaymentMethodPath } from '@/lib/payment/paths'
import DevFeeSummary from '@/components/DevFeeSummary'

function CardPageInner() {
  const router = useRouter()
  const params = useParams()
  const inquiryId = params.inquiryId
  const [inquiry, setInquiry] = useState(null)
  const [customerId, setCustomerId] = useState(null)
  const [linkedSiteId, setLinkedSiteId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { init() }, [inquiryId])

  async function init() {
    const user = await requireAuthUser()
    if (!user) { router.push('/login'); return }

    const { data: cust } = await supabase.from('customers').select('customer_id').eq('auth_id', user.id).single()
    if (!cust) { router.push('/login'); return }
    setCustomerId(cust.customer_id)

    const result = await loadInquiryForPayment(supabase, inquiryId, cust.customer_id)
    if (!result.ok) {
      alert(result.error)
      router.push('/my')
      return
    }

    setInquiry(result.inquiry)

    const { data: site } = await supabase
      .from('sites')
      .select('site_id')
      .eq('inquiry_id', inquiryId)
      .eq('use_flag', 1)
      .maybeSingle()
    if (site) setLinkedSiteId(site.site_id)

    setLoading(false)
  }

  async function handleMockPay() {
    setSubmitting(true)
    const amount = getFinalPaymentAmount(inquiry)
    const { error } = await completeFinalPaymentCardMock(supabase, {
      inquiryId,
      customerId,
      siteId: linkedSiteId,
      amount,
    })
    setSubmitting(false)
    if (error) {
      alert(error)
      return
    }
    alert('잔금 결제가 완료되었습니다. 서비스 시작 준비 단계로 이동합니다.')
    router.push('/my')
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
        <div style={{ background: 'white', borderRadius: 16, padding: '32px 28px', border: '1px solid #e5e7eb', marginTop: 16 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>카드 결제 (목업)</h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280' }}>
          지금 납부할 잔금 <strong style={{ color: '#b45309' }}>{amount?.toLocaleString()}원</strong>
        </p>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>
          실서비스 전환 시 토스페이먼츠 1회 결제로 연동됩니다.
        </p>
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
          <Link href={oneTimePaymentMethodPath(inquiryId)} style={{ color: '#6b7280' }}>← 다른 결제 수단</Link>
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
