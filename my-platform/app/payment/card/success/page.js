'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function CardSuccessForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const authKey    = searchParams.get('authKey')
  const customerKey = searchParams.get('customerKey')
  const siteId     = searchParams.get('site_id')

  const [status, setStatus] = useState('processing') // processing | success | error
  const [errorMsg, setErrorMsg] = useState('')
  const [site, setSite] = useState(null)

  useEffect(() => { confirmBillingAuth() }, [])

  async function confirmBillingAuth() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // 사이트 정보 조회
      if (siteId) {
        const { data: siteData } = await supabase
          .from('sites').select('*').eq('site_id', siteId).single()
        setSite(siteData)
      }

      // 테스트 모드: mock=true 이면 API 호출 없이 바로 성공
      const isMock = searchParams.get('mock') === 'true'
      if (isMock) { setStatus('success'); return }

      // 실제 토스 빌링키 승인
      if (!authKey || !customerKey) {
        setStatus('error'); setErrorMsg('인증 정보가 없습니다.'); return
      }

      const { data: cust } = await supabase
        .from('customers').select('*').eq('auth_id', user.id).single()

      const res = await fetch('/api/payment/billing-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authKey, customerKey, customerId: cust.customer_id, siteId }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || '빌링키 발급 실패')

      setStatus('success')
    } catch (e) {
      setErrorMsg(e.message)
      setStatus('error')
    }
  }

  if (status === 'processing') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8f7f4', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
      <p style={{ fontSize: 16, color: '#374151', fontWeight: 600 }}>카드 등록 처리 중...</p>
      <p style={{ fontSize: 13, color: '#9ca3af' }}>잠시만 기다려 주세요</p>
    </div>
  )

  if (status === 'error') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8f7f4', fontFamily: "'Pretendard', -apple-system, sans-serif", padding: 20 }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
      <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#111827' }}>카드 등록 실패</h2>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#9ca3af' }}>{errorMsg}</p>
      <button onClick={() => router.push(`/payment/card?site_id=${siteId}`)}
        style={{ padding: '12px 28px', background: '#111827', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
        다시 시도하기
      </button>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8f7f4', fontFamily: "'Pretendard', -apple-system, sans-serif", padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
        <div style={{ fontSize: 60, marginBottom: 20 }}>🎊</div>
        <h1 style={{ margin: '0 0 10px', fontSize: 24, fontWeight: 800, color: '#111827' }}>카드 등록 완료!</h1>
        <p style={{ margin: '0 0 32px', fontSize: 15, color: '#6b7280', lineHeight: 1.7 }}>
          월 30,000원이 자동으로 결제됩니다.<br />
          언제든지 마이페이지에서 해지할 수 있어요.
        </p>

        {site && (
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 28, textAlign: 'left' }}>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 4 }}>운영 중인 사이트</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{site.name}</div>
            <a href={`/preview/${site.subdomain}`} target="_blank"
              style={{ fontSize: 13, color: '#3b82f6', textDecoration: 'none' }}>
              {site.subdomain}.myplatform.com →
            </a>
          </div>
        )}

        <button onClick={() => router.push(site ? `/my/${site.subdomain}` : '/my')}
          style={{ width: '100%', padding: '14px 0', background: '#111827', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          내 사이트 관리하기
        </button>
      </div>
    </div>
  )
}

export default function CardSuccessPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f8f7f4' }} />}>
      <CardSuccessForm />
    </Suspense>
  )
}
