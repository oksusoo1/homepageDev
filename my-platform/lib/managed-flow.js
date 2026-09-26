/**
 * 본사 대리(managed) 제작·구독 플로우
 * 진도 SSOT = sites.status (FLOW_STEP)
 */

import { isSiteFlowStep } from '@/lib/site-flow'

export function isManagedSite(site) {
  return site?.build_type === 'managed'
}

/** 잔금 확인 후 · sites.status 가 pay_method 이상 */
export function canStartManagedService(inquiry, site) {
  if (!inquiry?.final_paid_at) return false
  const st = site?.status
  return isSiteFlowStep(st) && ['pay_method', 'trial', 'subscribed'].includes(st)
}

export function canAccessPaymentSetup(site, inquiry) {
  if (!isManagedSite(site)) return true
  if (!inquiry?.final_paid_at) return false
  const st = site?.status
  return ['pay_method', 'trial', 'subscribed', 'suspended'].includes(st)
}

export function managedNeedsGoLive(site, inquiry) {
  if (!isManagedSite(site)) return false
  if (!canStartManagedService(inquiry, site)) return false
  if (site.trial_started_at) return false
  return site.status === 'pay_method'
}

export function isInReviewPhase(site) {
  return site?.status === 'preview' || site?.status === 'balance'
}

export function managedBlockedMessage(inquiry, site) {
  if (!inquiry) return '본사 제작 문의가 연결되지 않았습니다.'
  if (!inquiry.final_paid_at) return '잔금 확인 후 서비스를 시작할 수 있습니다.'
  if (!canStartManagedService(inquiry, site)) {
    return '카드/계좌 등록 단계가 되면 서비스를 시작할 수 있습니다.'
  }
  return null
}

/** 선금 확인 전만 취소 — down_paid_at 또는 flow>=building 이면 불가 */
export function canCancelManagedIntake(inquiry, site) {
  if (!inquiry?.inquiry_id) return false
  if (inquiry.down_paid_at) return false
  const st = site?.status
  if (isSiteFlowStep(st)) {
    const idx = ['intake', 'deposit', 'building', 'preview', 'balance', 'pay_method', 'trial', 'subscribed', 'suspended']
    return idx.indexOf(st) <= idx.indexOf('deposit')
  }
  return true
}

