'use client'

import Link from 'next/link'

/**
 * 결제 화면 공통 결과 패널 — 브라우저 팝업(alert) 대신 화면 안 안내
 * kind: 'done'(접수·완료) | 'error'(진행 불가)
 */
export default function PaymentResultPanel({ kind = 'done', title, message, hint, actionLabel = '내 사이트로', actionHref = '/my' }) {
  const ok = kind === 'done'
  return (
    <div style={{
      minHeight: '100vh', background: '#f8f7f4', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 20, fontFamily: '-apple-system, "Malgun Gothic", sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: 'white', borderRadius: 16,
        border: '1px solid #e5e7eb', padding: '36px 28px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>{ok ? '✅' : '🔒'}</div>
        <h1 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: '#111827' }}>{title}</h1>
        <p style={{ margin: '0 0 8px', fontSize: 14, color: '#4b5563', lineHeight: 1.7 }}>{message}</p>
        {hint && (
          <p style={{
            margin: '16px 0 0', padding: '12px 14px', background: ok ? '#f0fdf4' : '#f9fafb',
            border: `1px solid ${ok ? '#bbf7d0' : '#e5e7eb'}`, borderRadius: 10,
            fontSize: 13, color: ok ? '#15803d' : '#6b7280', lineHeight: 1.6,
          }}>
            {hint}
          </p>
        )}
        <Link href={actionHref} style={{
          display: 'block', marginTop: 24, padding: '13px 0', background: '#111827', color: 'white',
          borderRadius: 10, textDecoration: 'none', fontSize: 15, fontWeight: 700,
        }}>
          {actionLabel}
        </Link>
      </div>
    </div>
  )
}
