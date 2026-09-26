/**
 * 결제 수단·계좌이체 공통 (플로우 v1.3.2)
 */

import { paymentMethodPath } from '@/lib/site-paths'
import { canAccessPaymentSetup, isManagedSite } from '@/lib/managed-flow'
import { getBankAccountText } from '@/lib/payment/common'
import { onlyActive } from '@/lib/use-flag'

export { getBankAccountText }

/** 계좌이체 등록 완료 여부 (구독 또는 검수 전 draft) */
export function isBankTransferReady(subscription, site = null) {
  if (
    subscription?.payment_method === 'manual' &&
    subscription?.bank_transfer_agreed_at &&
    subscription?.depositor_name
  ) {
    return true
  }
  const draft = site?.content?._billing_draft
  return !!(draft?.depositor_name && draft?.bank_transfer_agreed_at)
}

/**
 * 배포(go-live) 가능 여부
 * @returns {{ ready: boolean, method: 'card'|'manual'|null }}
 */
export function getBillingReadiness(card, subscription, site = null) {
  if (card) return { ready: true, method: 'card' }
  if (isBankTransferReady(subscription, site)) return { ready: true, method: 'manual' }
  return { ready: false, method: null }
}

/** 결제 방식 선택 URL (@param siteCode sites.subdomain) */
export function paymentMethodUrl(siteCode, redirect = 'deploy') {
  return paymentMethodPath(siteCode, redirect)
}

/**
 * managed 사이트: 잔금 전 결제 등록 차단
 */
export async function assertPaymentSetupAllowed(supabase, siteId) {
  const { data: site } = await onlyActive(
    supabase.from('sites').select('build_type, inquiry_id, status').eq('site_id', siteId)
  ).single()
  if (!isManagedSite(site)) return { ok: true }

  if (!site.inquiry_id) {
    return { ok: false, error: '본사 제작 문의가 연결되지 않았습니다.' }
  }
  const { data: inquiry } = await onlyActive(
    supabase.from('inquiries').select('final_paid_at').eq('inquiry_id', site.inquiry_id)
  ).single()
  if (!canAccessPaymentSetup(site, inquiry)) {
    return { ok: false, error: '잔금 확인 후 결제 수단을 등록할 수 있습니다.' }
  }
  return { ok: true }
}

