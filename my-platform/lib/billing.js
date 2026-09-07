/**
 * 결제 수단·계좌이체 공통 (플로우 v1.3.2)
 */

import { paymentMethodPath } from '@/lib/site-paths'
import { canAccessPaymentSetup, isManagedSite } from '@/lib/managed-flow'
import { getBankAccountText } from '@/lib/payment/common'
import { onlyActive, USE_FLAG_ON } from '@/lib/use-flag'

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
    supabase.from('sites').select('build_type, inquiry_id').eq('site_id', siteId)
  ).single()
  if (!isManagedSite(site)) return { ok: true }

  if (!site.inquiry_id) {
    return { ok: false, error: '본사 제작 문의가 연결되지 않았습니다.' }
  }
  const { data: inquiry } = await onlyActive(
    supabase.from('inquiries').select('status, final_paid_at').eq('inquiry_id', site.inquiry_id)
  ).single()
  if (!canAccessPaymentSetup(site, inquiry)) {
    return { ok: false, error: '잔금 확인 후 결제 수단을 등록할 수 있습니다.' }
  }
  return { ok: true }
}

/**
 * 계좌이체 등록 — 구독 행은 서비스 시작(deploySite) 시 생성
 * 서비스 시작 전에는 sites.content._billing_draft 에만 저장
 */
export async function registerBankTransfer(supabase, { customerId, siteId, depositorName }) {
  const gate = await assertPaymentSetupAllowed(supabase, siteId)
  if (!gate.ok) return { error: gate.error }

  const now = new Date().toISOString()
  const name = (depositorName || '').trim()
  if (!name) return { error: '입금자명을 입력해 주세요.' }

  const { data: existing } = await onlyActive(
    supabase.from('subscriptions').select('subscription_id, status').eq('site_id', siteId)
  ).maybeSingle()

  const draft = {
    depositor_name: name,
    bank_transfer_agreed_at: now,
  }

  if (existing) {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        payment_method: 'manual',
        depositor_name: name,
        bank_transfer_agreed_at: now,
        updated_at: now,
      })
      .eq('site_id', siteId)
      .eq('use_flag', USE_FLAG_ON)
    if (error) return { error: error.message }
    return { error: null }
  }

  const { data: site } = await onlyActive(
    supabase.from('sites').select('content').eq('site_id', siteId)
  ).single()

  const content = { ...(site?.content || {}), _billing_draft: draft }
  const { error } = await supabase
    .from('sites')
    .update({ content, updated_at: now })
    .eq('site_id', siteId)
    .eq('use_flag', USE_FLAG_ON)
  if (error) return { error: error.message }

  return { error: null }
}
