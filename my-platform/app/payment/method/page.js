'use client'
import { Suspense } from 'react'
import { LegacyPaymentRedirect } from '@/lib/payment-redirect'

export default function PaymentMethodRedirectPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>이동 중...</div>}>
      <LegacyPaymentRedirect target="method" />
    </Suspense>
  )
}
