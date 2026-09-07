'use client'

import Link from 'next/link'
import { paymentMethodCardStyle } from '@/lib/payment/common'

/**
 * 카드 / 계좌이체 선택 UI (구독·1회성 공용)
 */
export default function PaymentMethodChooser({
  title = '결제 수단 선택',
  subtitle,
  cardHref,
  cardTitle = '카드 결제',
  cardDesc = '카드로 결제합니다',
  bankHref,
  bankTitle = '계좌이체',
  bankDesc = '안내 계좌로 입금 · 본사 확인 후 처리',
  backHref,
  backLabel = '← 돌아가기',
  embedded = false,
}) {
  const inner = (
    <>
      <div style={{ textAlign: embedded ? 'left' : 'center', marginBottom: 28 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>{title}</h1>
        {subtitle && (
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>{subtitle}</p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Link href={cardHref} style={paymentMethodCardStyle}>
          <span style={{ fontSize: 28 }}>💳</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{cardTitle}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{cardDesc}</div>
          </div>
        </Link>

        <Link href={bankHref} style={paymentMethodCardStyle}>
          <span style={{ fontSize: 28 }}>🏦</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{bankTitle}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{bankDesc}</div>
          </div>
        </Link>
      </div>

      {backHref && (
        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13 }}>
          <Link href={backHref} style={{ color: '#6b7280' }}>{backLabel}</Link>
        </p>
      )}
    </>
  )

  if (embedded) {
    return <div style={{ background: 'white', borderRadius: 16, padding: '24px 22px', border: '1px solid #e5e7eb' }}>{inner}</div>
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f7f4', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 20, fontFamily: '-apple-system, "Malgun Gothic", sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>{inner}</div>
    </div>
  )
}
