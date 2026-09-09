'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { requireAuthUser } from '@/lib/auth'
import { onlyActive } from '@/lib/use-flag'
import { assertPaymentSetupAllowed } from '@/lib/billing'
import { paymentBankTransferPath, paymentCardPath, siteAdminPath } from '@/lib/site-paths'

function MethodChooser() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const siteCode = params.siteCode
  const redirect = searchParams.get('redirect') || 'deploy'

  const [site, setSite] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { init() }, [siteCode])

  async function init() {
    const user = await requireAuthUser()
    if (!user) { router.push('/login'); return }

    const { data: cust } = await onlyActive(
      supabase.from('customers').select('customer_id').eq('auth_id', user.id)
    ).single()
    if (!cust) { router.push('/login'); return }

    const { data: siteData } = await onlyActive(
      supabase.from('sites').select('name, subdomain, site_id, build_type, inquiry_id')
        .eq('subdomain', siteCode).eq('customer_id', cust.customer_id)
    ).single()
    if (!siteData) { router.push('/my'); return }

    const gate = await assertPaymentSetupAllowed(supabase, siteData.site_id)
    if (!gate.ok) {
      alert(gate.error)
      router.push(siteAdminPath(siteCode))
      return
    }

    setSite(siteData)
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f7f4' }}>
        <div style={{ color: '#9ca3af', fontSize: 14 }}>로딩 중...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f7f4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: '-apple-system, "Malgun Gothic", sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>결제 수단 선택</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>{site?.name} · 월 30,000원</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link href={paymentCardPath(siteCode, redirect)} style={cardStyle}>
            <span style={{ fontSize: 28 }}>💳</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>카드 자동결제</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>매월 자동 청구 (권장)</div>
            </div>
          </Link>

          <Link href={paymentBankTransferPath(siteCode, redirect)} style={cardStyle}>
            <span style={{ fontSize: 28 }}>🏦</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>계좌이체</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>안내 계좌로 입금 · 미납 2일 후 정지</div>
            </div>
          </Link>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13 }}>
          <Link href={siteAdminPath(siteCode)} style={{ color: '#6b7280' }}>← 돌아가기</Link>
        </p>
      </div>
    </div>
  )
}

const cardStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: '20px 22px',
  background: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  textDecoration: 'none',
  color: '#111827',
}

export default function PaymentMethodPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩...</div>}>
      <MethodChooser />
    </Suspense>
  )
}
