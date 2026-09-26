'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { requireAuthUser } from '@/lib/auth'
import { onlyActive } from '@/lib/use-flag'
import { assertPaymentSetupAllowed } from '@/lib/billing'
import { paymentCardSuccessPath, siteAdminPath, sitePublicHostname } from '@/lib/site-paths'
import { registerCardMockAction } from '@/app/s/[siteCode]/admin/actions'

// TODO: 실제 서비스 시 아래 플래그를 false로 변경 후 토스 연동
const MOCK_MODE = true

function CardRegisterForm() {
  const router = useRouter()
  const params = useParams()
  const siteCode = params.siteCode
  const searchParams = useSearchParams()
  const redirectParam = searchParams.get('redirect')

  const [site, setSite] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [cardNum, setCardNum] = useState('')
  const [expiry, setExpiry] = useState('')
  const [birth, setBirth] = useState('')
  const [pw, setPw] = useState('')

  useEffect(() => { init() }, [siteCode])

  async function init() {
    const user = await requireAuthUser()
    if (!user) { router.push('/login'); return }

    const { data: cust } = await onlyActive(
      supabase.from('customers').select('*').eq('auth_id', user.id)
    ).single()
    if (!cust) { router.push('/login'); return }

    const { data: siteData } = await onlyActive(
      supabase.from('sites').select('*').eq('subdomain', siteCode).eq('customer_id', cust.customer_id)
    ).single()
    if (!siteData) { router.push('/my'); return }

    const gate = await assertPaymentSetupAllowed(supabase, siteData.site_id)
    if (!gate.ok) {
      alert(gate.error)
      router.push(siteAdminPath(siteCode))
      return
    }

    setSite(siteData)

    const { data: sub } = await onlyActive(
      supabase.from('subscriptions').select('*').eq('site_id', siteData.site_id)
    ).maybeSingle()
    setSubscription(sub)

    setLoading(false)
  }

  // 카드번호 포맷 (1234 5678 1234 5678)
  function formatCardNum(val) {
    const digits = val.replace(/\D/g, '').slice(0, 16)
    return digits.replace(/(.{4})/g, '$1 ').trim()
  }

  // 유효기간 포맷 (MM/YY)
  function formatExpiry(val) {
    const digits = val.replace(/\D/g, '').slice(0, 4)
    if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2)
    return digits
  }

  async function handleCardRegister() {
    if (!cardNum || !expiry || !birth || !pw) {
      alert('모든 항목을 입력해주세요.'); return
    }
    setRegistering(true)

    // 잠깐 로딩 효과
    await new Promise(r => setTimeout(r, 1200))

    const last4 = cardNum.replace(/\s/g, '').slice(-4)
    if (!/^\d{4}$/.test(last4)) {
      alert('카드 번호를 입력해주세요.')
      setRegistering(false)
      return
    }

    const res = await registerCardMockAction(siteCode, {
      cardLast4: last4,
      alsoDeploy: redirectParam === 'deploy',
    })
    if (!res.ok) {
      alert(res.error)
      setRegistering(false)
      return
    }

    if (redirectParam === 'deploy') {
      router.push(siteAdminPath(siteCode))
      return
    }

    router.push(paymentCardSuccessPath(siteCode, true))
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f7f4' }}>
      <div style={{ color: '#9ca3af', fontSize: 14 }}>로딩 중...</div>
    </div>
  )

  const nextBilling = subscription?.next_billing_date
    ? new Date(subscription.next_billing_date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : '등록 후 익월 1일'

  return (
    <div style={{ minHeight: '100vh', background: '#f8f7f4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Pretendard', -apple-system, sans-serif", padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
          <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: '#111827' }}>카드 등록</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>정기 결제를 위한 카드를 등록해 주세요</p>
        </div>

        {/* 구독 정보 카드 */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', padding: '24px 28px', marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#374151' }}>구독 정보</h3>
          {[
            { label: '사이트', value: site?.name || '-' },
            { label: '주소', value: site ? sitePublicHostname(site.subdomain) : '-' },
            { label: '월 구독료', value: '30,000원' },
            { label: '첫 결제일', value: nextBilling },
          ].map(({ label, value }, i, arr) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 14, borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
              <span style={{ color: '#9ca3af' }}>{label}</span>
              <span style={{ color: '#111827', fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>

        {/* 테스트 모드 안내 */}
        {MOCK_MODE && (
          <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: '#854d0e' }}>
            🧪 <b>테스트 모드</b> — 실제 결제가 발생하지 않습니다. 아무 숫자나 입력하세요.
          </div>
        )}

        {/* 카드 입력 폼 */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', padding: '24px 28px', marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 700, color: '#374151' }}>카드 정보 입력</h3>

          {[
            { label: '카드 번호', testid: 'card-number', value: cardNum, setter: v => setCardNum(formatCardNum(v)), placeholder: '1234 5678 1234 5678', maxLen: 19 },
            { label: '유효기간 (MM/YY)', testid: 'card-expiry', value: expiry, setter: v => setExpiry(formatExpiry(v)), placeholder: '12/26', maxLen: 5 },
            { label: '생년월일 6자리', testid: 'card-birth', value: birth, setter: v => setBirth(v.replace(/\D/g, '').slice(0, 6)), placeholder: '901201', maxLen: 6 },
            { label: '카드 비밀번호 앞 2자리', testid: 'card-pw', value: pw, setter: v => setPw(v.replace(/\D/g, '').slice(0, 2)), placeholder: '••', maxLen: 2, type: 'password' },
          ].map(({ label, testid, value, setter, placeholder, maxLen, type }) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>{label}</label>
              <input
                type={type || 'text'}
                data-testid={testid}
                value={value}
                onChange={e => setter(e.target.value)}
                placeholder={placeholder}
                maxLength={maxLen}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 15, outline: 'none', boxSizing: 'border-box', letterSpacing: type === 'password' ? 4 : 0 }}
              />
            </div>
          ))}
        </div>

        {/* 안내 */}
        <div style={{ background: '#eff6ff', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#3b82f6', lineHeight: 1.7 }}>
          ℹ️ 카드를 등록하면 매월 자동으로 결제됩니다. 언제든지 해지할 수 있습니다.
        </div>

        {/* 카드 등록 버튼 */}
        <button data-testid="card-submit" onClick={handleCardRegister} disabled={registering} style={{
          width: '100%', padding: '15px 0', background: registering ? '#9ca3af' : '#111827',
          color: 'white', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700,
          cursor: registering ? 'default' : 'pointer', marginBottom: 12,
        }}>
          {registering ? '등록 처리 중...' : '카드 등록하기'}
        </button>

        <button onClick={() => router.push(site ? siteAdminPath(siteCode) : '/my')} style={{
          width: '100%', padding: '13px 0', background: 'white', color: '#6b7280',
          border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, cursor: 'pointer',
        }}>
          나중에 하기
        </button>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#9ca3af' }}>
          토스페이먼츠를 통해 안전하게 처리됩니다
        </p>
      </div>
    </div>
  )
}

export default function CardRegisterPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f8f7f4' }} />}>
      <CardRegisterForm />
    </Suspense>
  )
}
