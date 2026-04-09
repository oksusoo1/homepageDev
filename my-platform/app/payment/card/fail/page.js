'use client'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function CardFailForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const siteId  = searchParams.get('site_id')
  const message = searchParams.get('message') || '카드 등록이 취소되었습니다.'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8f7f4', fontFamily: "'Pretendard', -apple-system, sans-serif", padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>😢</div>
        <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 700, color: '#111827' }}>카드 등록 실패</h2>
        <p style={{ margin: '0 0 32px', fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>{message}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => router.push(`/payment/card?site_id=${siteId}`)}
            style={{ padding: '13px 0', background: '#111827', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            다시 시도하기
          </button>
          <button onClick={() => router.push('/my')}
            style={{ padding: '13px 0', background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, cursor: 'pointer' }}>
            나중에 하기
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CardFailPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f8f7f4' }} />}>
      <CardFailForm />
    </Suspense>
  )
}
