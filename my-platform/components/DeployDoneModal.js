'use client'

import { sitePublicPath, sitePublicHostname, paymentMethodPath } from '@/lib/site-paths'
import { getBankAccountText } from '@/lib/payment/common'

/**
 * 배포(서비스 시작) 완료 안내
 * 배포는 결제 수단 등록 후에만 되므로, **이미 등록한 수단**을 그대로 안내한다
 * (등록하라고 다시 시키지 않는다)
 */
export default function DeployDoneModal({ siteCode, trialEndsAt, card, subscription, onClose, onGoPayment }) {
  const method = card ? 'card' : subscription?.payment_method === 'manual' ? 'manual' : null
  const endText = trialEndsAt ? new Date(trialEndsAt).toLocaleDateString('ko-KR') : null
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt) - Date.now()) / (24 * 60 * 60 * 1000)))
    : null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: 'white', borderRadius: 16, padding: '40px 36px', maxWidth: 420, width: '100%',
        textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
        <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: '#111827' }}>사이트가 공개되었습니다</h2>
        {daysLeft !== null && (
          <p style={{ margin: '0 0 8px', fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>
            지금부터 <strong style={{ color: '#111827' }}>무료 체험 D-{daysLeft}</strong>
          </p>
        )}
        <a href={sitePublicPath(siteCode)} target="_blank" rel="noreferrer"
          style={{ display: 'inline-block', marginBottom: 24, fontSize: 13, color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
          {sitePublicHostname(siteCode)} →
        </a>

        <div style={{ background: '#f9fafb', borderRadius: 10, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
          {method === 'card' && (
            <>
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#111827' }}>
                💳 등록된 카드로 이어집니다
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                {card?.card_name || '카드'} •••• {card?.card_last4}
                {endText ? ` · ${endText} 체험 종료 후` : ' · 체험 종료 후'} 월 30,000원 자동 결제
                <br />언제든지 해지할 수 있습니다.
              </p>
            </>
          )}
          {method === 'manual' && (
            <>
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#111827' }}>
                🏦 계좌이체로 이어집니다
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                {getBankAccountText()}
                <br />{endText ? `${endText} 체험 종료 후` : '체험 종료 후'} 월 30,000원 · 입금자명 {subscription?.depositor_name || '—'}
              </p>
            </>
          )}
          {!method && (
            <>
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#111827' }}>💳 결제 수단을 등록해 주세요</p>
              <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>월 30,000원 · 언제든지 해지 가능</p>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '11px 0', background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
            확인
          </button>
          {method ? (
            <a href={sitePublicPath(siteCode)} target="_blank" rel="noreferrer"
              style={{ flex: 2, padding: '11px 0', background: '#111827', color: 'white', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              사이트 보기 →
            </a>
          ) : (
            <button onClick={() => onGoPayment?.(paymentMethodPath(siteCode, 'deploy'))}
              style={{ flex: 2, padding: '11px 0', background: '#111827', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              결제 수단 등록 →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
