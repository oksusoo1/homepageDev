'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Suspense } from 'react'

// useSearchParams는 Suspense 안에서만 사용 가능
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState('login') // 'login' | 'signup'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // URL 파라미터로 탭 초기값 설정 (?tab=signup 이면 회원가입 탭으로)
  useEffect(() => {
    if (searchParams.get('tab') === 'signup') setTab('signup')
    if (searchParams.get('error') === 'withdrawn') setError('탈퇴한 계정입니다. 이용해 주셔서 감사했습니다.')
  }, [searchParams])

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [signupForm, setSignupForm] = useState({ email: '', password: '', passwordConfirm: '', name: '', phone: '' })

  // ── 로그인 ──
  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email: loginForm.email,
      password: loginForm.password,
    })

    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않아요')
      setLoading(false)
    } else {
      router.push('/my')
    }
  }

  // ── 회원가입 ──
  async function handleSignup(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    // 비밀번호 확인
    if (signupForm.password !== signupForm.passwordConfirm) {
      setError('비밀번호가 일치하지 않아요')
      setLoading(false)
      return
    }
    if (signupForm.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요')
      setLoading(false)
      return
    }

    // 1. Supabase Auth 가입
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: signupForm.email,
      password: signupForm.password,
    })

    if (authError) {
      setError('가입 오류: ' + authError.message)
      setLoading(false)
      return
    }

    // 2. customers 테이블에 INSERT
    const { error: dbError } = await supabase
      .from('customers')
      .insert([{
        auth_id: authData.user.id,
        email: signupForm.email,
        name: signupForm.name,
        phone: signupForm.phone || null,
      }])

    if (dbError) {
      setError('고객 정보 저장 오류: ' + dbError.message)
      setLoading(false)
      return
    }

    // 3. 성공 → /my 로 이동
    setSuccess('✅ 가입 완료! 내 사이트 페이지로 이동합니다...')
    setTimeout(() => router.push('/my'), 1500)
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px',
    border: '1px solid #e5e7eb', borderRadius: 8,
    fontSize: 14, outline: 'none', color: '#111827',
    background: 'white', boxSizing: 'border-box',
  }
  const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: '#6b7280', marginBottom: 6, letterSpacing: '0.3px',
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f7f4',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
      padding: '40px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11,
              background: '#111827', margin: '0 auto 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, color: 'white', fontWeight: 900,
            }}>M</div>
          </Link>
          <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
            {tab === 'login' ? '내 사이트 관리' : '회원가입'}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
            {tab === 'login' ? '로그인하고 내 사이트를 관리해보세요' : 'MyPlatform과 함께 시작해보세요'}
          </p>
        </div>

        {/* 탭 */}
        <div style={{
          display: 'flex', background: '#ede9e3',
          borderRadius: 10, padding: 4, marginBottom: 24,
        }}>
          {[
            { key: 'login', label: '로그인' },
            { key: 'signup', label: '회원가입' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setError(''); setSuccess('') }}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 7,
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: tab === key ? 'white' : 'transparent',
                color: tab === key ? '#111827' : '#9ca3af',
                boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 폼 카드 */}
        <div style={{
          background: 'white', borderRadius: 16,
          border: '1px solid #e5e7eb', padding: 32,
        }}>

          {/* ── 로그인 폼 ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>이메일</label>
                <input
                  type="email" value={loginForm.email} required
                  onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                  placeholder="example@email.com" style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>비밀번호</label>
                <input
                  type="password" value={loginForm.password} required
                  onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="••••••••" style={inputStyle}
                />
              </div>

              {error && (
                <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: '#fef2f2', color: '#ef4444', fontSize: 13 }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '12px',
                background: '#111827', color: 'white', border: 'none',
                borderRadius: 8, fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}>
                {loading ? '로그인 중...' : '로그인'}
              </button>

              <p style={{ margin: '20px 0 0', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
                아직 계정이 없으신가요?{' '}
                <button onClick={() => setTab('signup')} type="button"
                  style={{ background: 'none', border: 'none', color: '#111827', fontWeight: 700, cursor: 'pointer', fontSize: 13, padding: 0 }}>
                  회원가입
                </button>
              </p>
            </form>
          )}

          {/* ── 회원가입 폼 ── */}
          {tab === 'signup' && (
            <form onSubmit={handleSignup}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>이름 *</label>
                <input
                  type="text" autoComplete="name" value={signupForm.name} required
                  onChange={e => setSignupForm({ ...signupForm, name: e.target.value })}
                  placeholder="홍길동" style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>이메일 *</label>
                <input
                  type="email" autoComplete="email" value={signupForm.email} required
                  onChange={e => setSignupForm({ ...signupForm, email: e.target.value })}
                  placeholder="example@email.com" style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>전화번호</label>
                <input
                  type="tel" autoComplete="tel" value={signupForm.phone}
                  onChange={e => setSignupForm({ ...signupForm, phone: e.target.value })}
                  placeholder="010-0000-0000" style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>비밀번호 * (6자 이상)</label>
                <input
                  type="password" autoComplete="new-password" value={signupForm.password} required
                  onChange={e => setSignupForm({ ...signupForm, password: e.target.value })}
                  placeholder="••••••••" style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>비밀번호 확인 *</label>
                <input
                  type="password" autoComplete="new-password" value={signupForm.passwordConfirm} required
                  onChange={e => setSignupForm({ ...signupForm, passwordConfirm: e.target.value })}
                  placeholder="••••••••" style={inputStyle}
                />
              </div>

              {error && (
                <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: '#fef2f2', color: '#ef4444', fontSize: 13 }}>
                  {error}
                </div>
              )}
              {success && (
                <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: '#f0fdf4', color: '#16a34a', fontSize: 13 }}>
                  {success}
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '12px',
                background: '#111827', color: 'white', border: 'none',
                borderRadius: 8, fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}>
                {loading ? '처리 중...' : '가입하기'}
              </button>

              <p style={{ margin: '20px 0 0', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
                이미 계정이 있으신가요?{' '}
                <button onClick={() => setTab('login')} type="button"
                  style={{ background: 'none', border: 'none', color: '#111827', fontWeight: 700, cursor: 'pointer', fontSize: 13, padding: 0 }}>
                  로그인
                </button>
              </p>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}

// Suspense wrapper (useSearchParams 요구사항)
export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f8f7f4' }} />}>
      <LoginForm />
    </Suspense>
  )
}
