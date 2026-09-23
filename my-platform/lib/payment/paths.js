/**
 * 결제 URL 헬퍼 (구독 + 1회성)
 * 구독: Site Realm /s/{siteCode}/admin/payment/...
 * 1회성(개발비): Account Realm /my/payment/one-time/...
 * 1회성(도메인 등): Site Realm — 추후 siteOneTimePaymentMethodPath 사용
 */

export {
  paymentMethodPath,
  paymentCardPath,
  paymentBankTransferPath,
  paymentCardSuccessPath,
  paymentCardFailPath,
} from '@/lib/site-paths'

/**
 * managed 개발비 — 문의(inquiry) 기준
 * @param {'down'|'final'} stage 선금 | 잔금
 */
function oneTimePath(inquiryId, page, stage) {
  const q = stage === 'down' ? '?stage=down' : ''
  return `/my/payment/one-time/${inquiryId}/${page}${q}`
}

export function oneTimePaymentMethodPath(inquiryId, stage = 'final') {
  return oneTimePath(inquiryId, 'method', stage)
}

export function oneTimePaymentCardPath(inquiryId, stage = 'final') {
  return oneTimePath(inquiryId, 'card', stage)
}

export function oneTimePaymentBankTransferPath(inquiryId, stage = 'final') {
  return oneTimePath(inquiryId, 'bank-transfer', stage)
}

/** self 도메인 대행 등 — 사이트 기준 (추후 연동) */
export function siteOneTimePaymentMethodPath(siteCode, paymentId) {
  return `/s/${siteCode}/admin/payment/one-time/${paymentId}/method`
}
