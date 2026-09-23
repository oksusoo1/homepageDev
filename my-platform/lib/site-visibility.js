/**
 * 사이트 공개 범위 — sites.status(FLOW_STEP) 기준
 */

import { visibilityFromSite, isSiteFlowStep } from '@/lib/site-flow'

/** @typedef {'producer'|'partial'|'public'|'hidden'} SiteVisibility */

const FLOW_TO_VISIBILITY = {
  intake: 'producer',
  deposit: 'producer',
  building: 'producer',
  preview: 'partial',
  balance: 'partial',
  pay_method: 'public',
  trial: 'public',
  subscribed: 'public',
  suspended: 'hidden',
}

export function visibilityFromFlowStep(flowStep) {
  return FLOW_TO_VISIBILITY[flowStep] || 'producer'
}

/**
 * @param {object|null|undefined} site
 * @param {{ finalPending?: boolean }} [ctx]
 */
export function resolveSiteVisibility(site, ctx = {}) {
  if (!site) return { flowStep: 'suspended', visibility: 'hidden' }
  if (!isSiteFlowStep(site.status)) {
    return { flowStep: 'suspended', visibility: 'hidden' }
  }
  let flowStep = site.status
  if (flowStep === 'preview' && ctx.finalPending) flowStep = 'balance'
  return { flowStep, visibility: visibilityFromFlowStep(flowStep) }
}

/**
 * 본사(staff)는 모든 단계 열람 가능 — 고객 요청 응대·검수 때문
 * producer(제작 중): 대리=본사만 · 셀프=본사+사장님(고객이 만드는 중이므로 사장님도)
 */
export function canViewByVisibility(visibility, buildType, who) {
  if (visibility === 'public') return true
  if (visibility === 'hidden') return false
  if (who.isStaff) return true
  if (visibility === 'partial') return !!who.isOwner
  return buildType === 'self' && !!who.isOwner
}

export { visibilityFromSite }
