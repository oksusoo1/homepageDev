'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { loadCustomerSelfAction, checkSubdomainTakenAction } from '@/app/session/actions'
import Link from 'next/link'
import { Suspense } from 'react'
import { templateCategoryMeta } from '@/lib/template-category'
import { validateSubdomain, SUBDOMAIN_MIN, SUBDOMAIN_MAX } from '@/lib/subdomain-rules'
import { createSelfSiteAction } from '@/app/my/actions'

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
    const res = await loadCustomerSelfAction()
    if (!res.ok) { router.push('/login'); return }
    setCustomer(res.data.customer)
    setPageLoading(false)
  }

  // 서브도메인 규칙 + 중복 체크 (디바운스). 서버 검사가 최종.
  useEffect(() => {
    if (!form.subdomain) { setSubdomainStatus('idle'); return }
    const v = validateSubdomain(form.subdomain)
    if (!v.ok) { setSubdomainStatus('invalid'); return }

    setSubdomainStatus('checking')
    const timer = setTimeout(async () => {
      const taken = await checkSubdomainTakenAction(v.value)
      setSubdomainStatus(taken.ok && taken.data.taken ? 'taken' : 'available')
    }, 500)
    return () => clearTimeout(timer)
  }, [form.subdomain])

  // 사이트명만 갱신 (주소명과 분리)
  function handleNameChange(value) {
    setForm(prev => ({ ...prev, name: value }))
  }

  function handleSubdomainChange(value) {
    const cleaned = value.replace(/[^a-zA-Z0-9-]/g, '')
    setForm(prev => ({ ...prev, subdomain: cleaned }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const v = validateSubdomain(form.subdomain)
    if (!v.ok) { setError(v.error); return }
    if (subdomainStatus === 'taken') { setError('이미 사용 중인 사이트주소명이에요'); return }
    if (!form.name.trim()) { setError('사이트명을 입력해주세요'); return }

    setLoading(true)
    setError('')

    const res = await createSelfSiteAction({
      templateId,
      name: form.name,
      subdomain: form.subdomain,
      description: form.description,
      address: form.address,
      phone: form.phone,
      email: form.email,
    })
    if (!res.ok) {
      setError(res.error)
      setLoading(false)
      return
    }
    router.push('/my?created=1')
  }

  const meta = templateCategoryMeta(category)

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

  // 사이트주소명 상태 표시 (idle일 때는 고정 안내만)
  const rule = validateSubdomain(form.subdomain)
  const subdomainHint = {
    idle:      { color: '#9ca3af', text: `영문 소문자·숫자·하이픈 ${SUBDOMAIN_MIN}~${SUBDOMAIN_MAX}자. 예약 주소는 쓸 수 없어요.` },
    checking:  { color: '#9ca3af', text: '확인 중...' },
    available: { color: '#16a34a', text: '✓ 사용 가능한 주소명이에요' },
    taken:     { color: '#dc2626', text: '✗ 이미 사용 중이에요. 다른 주소명을 입력해주세요' },
    invalid:   { color: '#dc2626', text: rule.ok ? '주소를 확인해 주세요' : rule.error },
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
              <label style={{ ...css.label, display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span>사이트명 *</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af' }}>한글·영문 가능</span>
              </label>
              <input
                type="text"
                data-testid="setup-name"
                value={form.name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="예: 마곡카페"
                required
                autoComplete="off"
                style={css.input}
              />
            </div>

            {/* 사이트주소명 → subdomain */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ ...css.label, display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span>사이트주소명 *</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af' }}>영문 소문자·숫자·하이픈, {SUBDOMAIN_MIN}~{SUBDOMAIN_MAX}자</span>
              </label>
              <div style={{
                display: 'flex', alignItems: 'center',
                border: '1.5px solid',
                borderColor: subdomainStatus === 'available' ? '#16a34a'
                  : subdomainStatus === 'taken' || subdomainStatus === 'invalid' ? '#dc2626'
                  : '#e5e7eb',
                borderRadius: 8, background: 'white', overflow: 'hidden',
              }}>
                <input
                  type="text"
                  data-testid="setup-subdomain"
                  value={form.subdomain}
                  onChange={e => handleSubdomainChange(e.target.value)}
                  placeholder="예: magokcafe"
                  required
                  autoComplete="off"
                  style={{
                    ...css.input,
                    border: 'none',
                    borderRadius: 0,
                    flex: 1,
                    minWidth: 0,
                  }}
                />
                <span style={{
                  flexShrink: 0, padding: '0 14px', fontSize: 13, color: '#6b7280',
                  background: '#f9fafb', alignSelf: 'stretch',
                  display: 'flex', alignItems: 'center',
                  borderLeft: '1px solid #e5e7eb',
                }}>
                  .myplatform.com
                </span>
              </div>
              {subdomainHint && (
                <div data-testid="setup-subdomain-hint" style={{ ...css.hint, color: subdomainHint.color }}>
                  {subdomainHint.text}
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
            <div data-testid="setup-error" style={{
              margin: '16px 0 0', padding: '12px 16px', borderRadius: 8,
              background: '#fef2f2', color: '#dc2626', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* 제출 버튼 */}
          <button
            type="submit"
            data-testid="setup-submit"
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
