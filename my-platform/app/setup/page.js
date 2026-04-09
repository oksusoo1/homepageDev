'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Suspense } from 'react'

const CATEGORY_META = {
  cafe:       { label: '카페',      icon: '☕' },
  restaurant: { label: '식당',      icon: '🍽' },
  salon:      { label: '미용실',    icon: '💇' },
  clinic:     { label: '병원/의원', icon: '🏥' },
  academy:    { label: '학원',      icon: '📚' },
  general:    { label: '일반 소개', icon: '🏢' },
}

function SetupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const templateId = searchParams.get('template')
  const category = searchParams.get('category') || 'general'

  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [subdomainStatus, setSubdomainStatus] = useState('idle') // idle | checking | available | taken
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    subdomain: '',
    phone: '',
    address: '',
    description: '',
    email: '',
  })

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: cust } = await supabase
      .from('customers').select('*').eq('auth_id', user.id).single()
    if (!cust) { router.push('/login'); return }

    setCustomer(cust)
    setPageLoading(false)
  }

  // 서브도메인 중복 체크 (디바운스)
  useEffect(() => {
    if (!form.subdomain) { setSubdomainStatus('idle'); return }
    if (!/^[a-z0-9-]+$/.test(form.subdomain)) { setSubdomainStatus('invalid'); return }

    setSubdomainStatus('checking')
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('sites').select('site_id').eq('subdomain', form.subdomain).single()
      setSubdomainStatus(data ? 'taken' : 'available')
    }, 500)
    return () => clearTimeout(timer)
  }, [form.subdomain])

  // 사이트명 → 서브도메인 자동 추천
  function handleNameChange(value) {
    setForm(prev => {
      const newForm = { ...prev, name: value }
      // 서브도메인이 비어있으면 자동 변환
      if (!prev.subdomain) {
        const auto = value
          .toLowerCase()
          .replace(/\s+/g, '')           // 공백 제거
          .replace(/[^a-z0-9-]/g, '')    // 영문/숫자/- 만 허용
          .slice(0, 20)
        newForm.subdomain = auto
      }
      return newForm
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (subdomainStatus === 'taken') { setError('이미 사용 중인 서브도메인이에요'); return }
    if (subdomainStatus === 'invalid') { setError('서브도메인은 영문 소문자, 숫자, - 만 사용 가능해요'); return }
    if (!form.name.trim()) { setError('사이트명을 입력해주세요'); return }
    if (!form.subdomain.trim()) { setError('서브도메인을 입력해주세요'); return }

    setLoading(true)
    setError('')

    try {
      // sites 테이블 INSERT
      const site_code = form.subdomain + '_' + Date.now()
      const { data: site, error: sErr } = await supabase
        .from('sites')
        .insert([{
          site_code,
          customer_id: customer.customer_id,
          template_id: templateId || null,
          name: form.name.trim(),
          subdomain: form.subdomain.trim(),
          description: form.description.trim() || null,
          address: form.address.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          build_type: 'self',
          status: 'draft',
          deploy_status: 'pending',          
        }])
        .select()
        .single()

      if (sErr) throw new Error(sErr.message)

      // subscriptions 생성 (draft 상태로)
      await supabase.from('subscriptions').insert([{
        customer_id: customer.customer_id,
        site_id: site.site_id,
        amount: 30000,
        payment_method: 'manual',
        status: 'pending',
      }])

      // 완료 → 내 사이트로
      router.push('/my?created=1')

    } catch (err) {
      setError('사이트 생성 오류: ' + err.message)
      setLoading(false)
    }
  }

  const meta = CATEGORY_META[category] || CATEGORY_META.general

  const css = {
    label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 },
    input: {
      width: '100%', padding: '11px 14px',
      border: '1px solid #e5e7eb', borderRadius: 8,
      fontSize: 14, outline: 'none', color: '#111827',
      background: 'white', boxSizing: 'border-box',
    },
    hint: { fontSize: 11, marginTop: 5 },
  }

  // 서브도메인 상태 표시
  const subdomainHint = {
    idle:      { color: '#9ca3af', text: '영문 소문자, 숫자, - 만 사용 가능해요' },
    checking:  { color: '#9ca3af', text: '확인 중...' },
    available: { color: '#16a34a', text: '✓ 사용 가능한 주소예요' },
    taken:     { color: '#dc2626', text: '✗ 이미 사용 중이에요. 다른 주소를 입력해주세요' },
    invalid:   { color: '#dc2626', text: '✗ 영문 소문자, 숫자, - 만 사용 가능해요' },
  }[subdomainStatus]

  if (pageLoading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8f7f4', fontFamily: "'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      <div style={{ color: '#9ca3af', fontSize: 14 }}>로딩 중...</div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f7f4',
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>

      {/* 헤더 */}
      <div style={{
        background: 'white', borderBottom: '1px solid #e5e7eb',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/templates" style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'none' }}>
            ← 템플릿 선택
          </Link>
          <span style={{ color: '#e5e7eb' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7, background: '#111827',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: 'white', fontWeight: 800,
            }}>M</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>사이트 정보 입력</span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          Step 2/2 — 기본 정보 입력
        </div>
      </div>

      <div style={{ maxWidth: 540, margin: '0 auto', padding: '48px 20px 80px' }}>

        {/* 선택된 템플릿 표시 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'white', borderRadius: 12, border: '1px solid #e5e7eb',
          padding: '14px 18px', marginBottom: 28,
        }}>
          <span style={{ fontSize: 24 }}>{meta.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{meta.label} 템플릿 선택됨</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>아래 정보를 입력하면 사이트가 바로 생성돼요</div>
          </div>
          <Link href="/templates" style={{
            marginLeft: 'auto', fontSize: 11, color: '#9ca3af',
            textDecoration: 'none', padding: '4px 10px',
            border: '1px solid #e5e7eb', borderRadius: 6,
          }}>변경</Link>
        </div>

        {/* 입력 폼 */}
        <form onSubmit={handleSubmit}>
          <div style={{
            background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', padding: '28px 28px',
          }}>
            <h3 style={{ margin: '0 0 24px', fontSize: 15, fontWeight: 700, color: '#111827' }}>
              사이트 기본 정보
            </h3>

            {/* 사이트명 */}
            <div style={{ marginBottom: 20 }}>
              <label style={css.label}>사이트명 (업체명) *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="예: 홍길동 카페"
                required
                autoComplete="off"
                style={css.input}
              />
            </div>

            {/* 서브도메인 */}
            <div style={{ marginBottom: 20 }}>
              <label style={css.label}>사이트 주소 (서브도메인) *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={form.subdomain}
                  onChange={e => setForm({ ...form, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  placeholder="예: hongcafe"
                  required
                  autoComplete="off"
                  style={{
                    ...css.input,
                    paddingRight: 160,
                    borderColor: subdomainStatus === 'available' ? '#16a34a'
                      : subdomainStatus === 'taken' || subdomainStatus === 'invalid' ? '#dc2626'
                      : '#e5e7eb',
                  }}
                />
                <span style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 12, color: '#9ca3af', pointerEvents: 'none',
                }}>
                  .myplatform.com
                </span>
              </div>
              <div style={{ ...css.hint, color: subdomainHint.color }}>
                {subdomainHint.text}
              </div>
              {form.subdomain && (
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                  주소: <strong>https://{form.subdomain}.myplatform.com</strong>
                </div>
              )}
            </div>

            {/* 전화번호 */}
            <div style={{ marginBottom: 20 }}>
              <label style={css.label}>전화번호</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="예: 02-1234-5678"
                autoComplete="off"
                style={css.input}
              />
            </div>

            {/* 주소 */}
            <div style={{ marginBottom: 20 }}>
              <label style={css.label}>주소</label>
              <input
                type="text"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="예: 서울시 강남구 테헤란로 123"
                autoComplete="off"
                style={css.input}
              />
            </div>

            {/* 이메일 */}
            <div style={{ marginBottom: 20 }}>
              <label style={css.label}>이메일</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="예: hello@mycafe.com"
                autoComplete="off"
                style={css.input}
              />
            </div>

            {/* 소개글 */}
            <div style={{ marginBottom: 8 }}>
              <label style={css.label}>업체 소개글</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="업체를 간단히 소개해주세요. 사이트 메인 화면에 표시돼요."
                rows={3}
                style={{ ...css.input, resize: 'vertical' }}
              />
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div style={{
              margin: '16px 0 0', padding: '12px 16px', borderRadius: 8,
              background: '#fef2f2', color: '#dc2626', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading || subdomainStatus === 'taken' || subdomainStatus === 'invalid' || subdomainStatus === 'checking'}
            style={{
              width: '100%', marginTop: 20, padding: '15px',
              background: '#111827', color: 'white', border: 'none',
              borderRadius: 10, fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: (loading || subdomainStatus === 'taken' || subdomainStatus === 'checking') ? 0.6 : 1,
            }}>
            {loading ? '사이트 생성 중...' : '사이트 만들기 →'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 12 }}>
            배포 전까지 무료 · 배포 후 월 ₩30,000 자동이체
          </p>
        </form>
      </div>
    </div>
  )
}

export default function SetupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f8f7f4' }} />}>
      <SetupForm />
    </Suspense>
  )
}
