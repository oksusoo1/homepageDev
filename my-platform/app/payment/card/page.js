'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// TODO: 실제 서비스 시 아래 플래그를 false로 변경 후 토스 연동
const MOCK_MODE = true

export default function CardRegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const siteId = searchParams.get('site_id')

  const [site, setSite] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [cardNum, setCardNum] = useState('')
  const [expiry, setExpiry] = useState('')
  const [birth, setBirth] = useState('')
  const [pw, setPw] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: cust } = await supabase
      .from('customers').select('*').eq('auth_id', user.id).single()
    if (!cust) { router.push('/login'); return }
    setCustomer(cust)

    if (siteId) {
      const { data: siteData } = await supabase
        .from('sites').select('*').eq('site_id', siteId).eq('customer_id', cust.customer_id).single()
      setSite(siteData)

      const { data: sub } = await supabase
        .from('subscriptions').select('*').eq('site_id', siteId).maybeSingle()
      setSubscription(sub)
    }

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
    const mockBillingKey = `MOCK_BILLING_${customer.customer_id}_${Date.now()}`

    console.log('[카드등록] 시작', { customerId: customer.customer_id, last4, siteId })

    // 기존 카드 비활성화
    await supabase.from('customer_payment_methods')
      .update({ is_default: false, is_active: false })
      .eq('customer_id', customer.customer_id)

    // 새 카드 insert
    const { data: pmData, error: pmError } = await supabase.from('customer_payment_methods').insert({
      customer_id:    customer.customer_id,
      pg_provider:    'toss',
      pg_customer_id: mockBillingKey,
      card_last4:     last4,
      card_brand:     '테스트카드',
      card_name:      '개인',
      is_default:     true,
      is_active:      true,
    })
    console.log('[카드등록] customer_payment_methods 결과', { pmData, pmError })

    // 구독 payment_method → 'card' 업데이트
    if (siteId) {
      const { data: subData, error: subError } = await supabase.from('subscriptions')
        .update({ payment_method: 'card', updated_at: new Date().toISOString() })
        .eq('site_id', siteId)
      console.log('[카드등록] subscriptions 업데이트 결과', { subData, subError })
    }

    console.log('[카드등록] 완료 → success 페이지 이동')
    router.push(`/payment/card/success?site_id=${siteId}&mock=true`)
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
            { label: '주소', value: site ? `${site.subdomain}.myplatform.com` : '-' },
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
            { label: '카드 번호', value: cardNum, setter: v => setCardNum(formatCardNum(v)), placeholder: '1234 5678 1234 5678', maxLen: 19 },
            { label: '유효기간 (MM/YY)', value: expiry, setter: v => setExpiry(formatExpiry(v)), placeholder: '12/26', maxLen: 5 },
            { label: '생년월일 6자리', value: birth, setter: v => setBirth(v.replace(/\D/g, '').slice(0, 6)), placeholder: '901201', maxLen: 6 },
            { label: '카드 비밀번호 앞 2자리', value: pw, setter: v => setPw(v.replace(/\D/g, '').slice(0, 2)), placeholder: '••', maxLen: 2, type: 'password' },
          ].map(({ label, value, setter, placeholder, maxLen, type }) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>{label}</label>
              <input
                type={type || 'text'}
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
        <button onClick={handleCardRegister} disabled={registering} style={{
          width: '100%', padding: '15px 0', background: registering ? '#9ca3af' : '#111827',
          color: 'white', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700,
          cursor: registering ? 'default' : 'pointer', marginBottom: 12,
        }}>
          {registering ? '등록 처리 중...' : '카드 등록하기'}
        </button>

        <button onClick={() => router.push(site ? `/my/${site.subdomain}` : '/my')} style={{
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
