/**
 * 구독 행 생명 — status 컬럼 없음
 * 청구 대상·해지 = sites.status + cancelled_at / cancels_at
 */

import { flowStepLabel } from '@/lib/flow-step'

/** 청구 배치 대상 */
export function isBillableSubscription(site, sub) {
  if (!sub?.next_billing_date || sub.cancelled_at) return false
  const st = site?.status
  return st === 'trial' || st === 'subscribed'
}

/** 유료 구독 중 (탈퇴 시 잔여기간 보장 등) */
export function isPaidSubscription(site, sub) {
  return !!(
    site?.status === 'subscribed'
    && sub?.payment_method === 'card'
    && sub?.next_billing_date
    && !sub.cancelled_at
  )
}

/** 해지 예정일 경과 */
export function isCancelDue(sub, now = new Date()) {
  if (!sub?.cancels_at) return false
  return new Date(sub.cancels_at) <= now
}

/**
 * 화면 플래그
 * - 해지예약: cancels_at 미래
 * - 해지완료: cancelled_at 있고 예약 아님
 */
export function getSubscriptionUiFlags(site, sub) {
  if (!sub) {
    return { isTrial: false, isPendingCancel: false, isCancelled: false, canCancel: false, statusText: '구독 없음' }
  }
  const now = new Date()
  const isPendingCancel = !!(sub.cancels_at && new Date(sub.cancels_at) > now)
  const isCancelled = !!(sub.cancelled_at && !isPendingCancel)
  const isTrial = site?.status === 'trial' && !isPendingCancel && !isCancelled
  const canCancel = site?.status === 'subscribed' && !isPendingCancel && !isCancelled
  return {
    isTrial,
    isPendingCancel,
    isCancelled,
    canCancel,
    statusText: subscriptionLifeLabel(site, sub),
  }
}

/** 화면 표시용 짧은 라벨 */
export function subscriptionLifeLabel(site, sub) {
  if (!sub) return '구독 없음'
  const now = new Date()
  if (sub.cancels_at && new Date(sub.cancels_at) > now) return '해지예정'
  if (sub.cancelled_at) return '해지'
  if (site?.status === 'trial') return flowStepLabel('trial')
  if (site?.status === 'subscribed') return flowStepLabel('subscribed')
  if (site?.status === 'suspended') return flowStepLabel('suspended')
  return flowStepLabel(site?.status) || '—'
}
