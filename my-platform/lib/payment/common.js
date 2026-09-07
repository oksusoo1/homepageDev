/** 결제 공통 상수·유틸 (구독·1회성 공용) */

export const SUBSCRIPTION_MONTHLY_AMOUNT = 30000

/** 고객 화면에 표시할 입금 계좌 */
export function getBankAccountText() {
  return process.env.NEXT_PUBLIC_BANK_ACCOUNT || '국민 000-000-000000 (주)마이플랫폼'
}

export const paymentMethodCardStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: '20px 22px',
  background: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  textDecoration: 'none',
  color: '#111827',
}
