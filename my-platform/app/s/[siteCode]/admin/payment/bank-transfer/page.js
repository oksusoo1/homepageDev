'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { onlyActive } from '@/lib/use-flag'
import { deploySite } from '@/lib/deploy'
import { assertPaymentSetupAllowed } from '@/lib/billing'
import { getBankAccountText, registerBankTransfer } from '@/lib/billing'
import { paymentMethodPath, siteAdminPath } from '@/lib/site-paths'

function BankTransferForm() {
  const router = useRouter()
  const params = useParams()
  const siteCode = params.siteCode
  const searchParams = useSearchParams()
  const redirectParam = searchParams.get('redirect')

  const [site, setSite] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [depositorName, setDepositorName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const bankAccount = getBankAccountText()

  useEffect(() => { init() }, [siteCode])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: cust } = await onlyActive(
      supabase.from('customers').select('*').eq('auth_id', user.id)
    ).single()
    if (!cust) { router.push('/login'); return }
    setCustomer(cust)
    setDepositorName(cust.name || '')

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
    if (sub?.depositor_name) setDepositorName(sub.depositor_name)

    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!agreed) { setError('이용 안내에 동의해 주세요.'); return }

    setSubmitting(true)
    const reg = await registerBankTransfer(supabase, {
      customerId: customer.customer_id,
      siteId: site.site_id,
      depositorName,
    })
    if (reg.error) {
      setError(reg.error)
      setSubmitting(false)
      return
    }

    const { data: sub } = await onlyActive(
      supabase.from('subscriptions').select('*').eq('site_id', site.site_id)
    ).maybeSingle()

    if (redirectParam === 'deploy' && site) {
      const { error: deployErr } = await deploySite(
        site.site_id, customer.customer_id, sub, site, 'manual'
      )
      if (deployErr) {
        setError(deployErr)
        setSubmitting(false)
        return
      }
      if (site.inquiry_id) {
        await supabase.from('inquiries')
          .update({ status: 'done', updated_at: new Date().toISOString() })
          .eq('inquiry_id', site.inquiry_id)
      }
      router.push(siteAdminPath(siteCode))
      return
    }

    router.push(`${siteAdminPath(siteCode)}?tab=payment`)
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
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏦</div>
          <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>계좌이체 등록</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>월 구독료는 아래 계좌로 입금해 주세요</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', padding: '22px 24px', marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#374151' }}>입금 계좌</h3>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '14px 16px', fontSize: 15, fontWeight: 700, color: '#065f46', letterSpacing: '0.02em' }}>
              {bankAccount}
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#9ca3af' }}>입금자명은 아래 이름과 동일해야 확인이 빠릅니다.</p>
          </div>

          <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', padding: '22px 24px', marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>입금자명 *</label>
            <input
              value={depositorName}
              onChange={e => setDepositorName(e.target.value)}
              placeholder="홍길동"
              required
              style={inputStyle}
            />
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9ca3af' }}>사이트: {site?.name} · 월 30,000원</p>
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#374151', marginBottom: 20, cursor: 'pointer' }}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 3 }} />
            <span>매월 납부 기한까지 입금하지 않으면 <strong>2일 유예 후</strong> 사이트가 정지될 수 있음에 동의합니다.</span>
          </label>

          {error && (
            <div style={{ padding: '12px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>
          )}

          <button type="submit" disabled={submitting} style={btnStyle}>
            {submitting ? '처리 중...' : redirectParam === 'deploy' ? '등록하고 배포하기' : '계좌이체 등록하기'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13 }}>
          <Link href={paymentMethodPath(siteCode, redirectParam || 'deploy')} style={{ color: '#6b7280' }}>← 다른 결제 수단 선택</Link>
        </p>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: 8,
  fontSize: 14, boxSizing: 'border-box',
}
const btnStyle = {
  width: '100%', padding: '14px', background: '#111827', color: 'white', border: 'none',
  borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer',
}

export default function BankTransferPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>로딩...</div>}>
      <BankTransferForm />
    </Suspense>
  )
}
