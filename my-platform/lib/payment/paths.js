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

/** managed 개발비 — 문의(inquiry) 기준 */
export function oneTimePaymentMethodPath(inquiryId) {
  return `/my/payment/one-time/${inquiryId}/method`
}

export function oneTimePaymentCardPath(inquiryId) {
  return `/my/payment/one-time/${inquiryId}/card`
}

export function oneTimePaymentBankTransferPath(inquiryId) {
  return `/my/payment/one-time/${inquiryId}/bank-transfer`
}

/** self 도메인 대행 등 — 사이트 기준 (추후 연동) */
export function siteOneTimePaymentMethodPath(siteCode, paymentId) {
  return `/s/${siteCode}/admin/payment/one-time/${paymentId}/method`
}
