/**
 * 사이트 공개 범위 (FLOW_STEP 기준)
 * 룰: .cursor/rules/site-visibility.mdc
 *
 * @typedef {'producer'|'partial'|'public'|'hidden'} SiteVisibility
 */

import {
  resolveManagedFlowStep,
  resolveSelfFlowStep,
} from '@/lib/flow-step'

/** @type {Record<string, SiteVisibility>} */
const FLOW_TO_VISIBILITY = {
  intake: 'producer',
  deposit: 'producer',
  building: 'producer',
  done_build: 'partial',
  preview: 'partial',
  balance: 'partial',
  pay_method: 'public',
  trial: 'public',
  subscribed: 'public',
  suspended: 'hidden',
}

/**
 * @param {string|null|undefined} flowStep
 * @returns {SiteVisibility}
 */
export function visibilityFromFlowStep(flowStep) {
  return FLOW_TO_VISIBILITY[flowStep] || 'producer'
}

/**
 * @param {object|null|undefined} site
 * @param {{ inquiry?: object|null, subscription?: object|null, finalPending?: boolean }} [ctx]
 * @returns {{ flowStep: string, visibility: SiteVisibility }}
 */
export function resolveSiteVisibility(site, ctx = {}) {
  if (!site) {
    return { flowStep: 'suspended', visibility: 'hidden' }
  }
  if (site.status === 'suspended' || site.status === 'cancelled') {
    return { flowStep: 'suspended', visibility: 'hidden' }
  }

  const { inquiry = null, subscription = null, finalPending = false } = ctx
  const flowStep = site.build_type === 'managed'
    ? resolveManagedFlowStep(inquiry, { site, subscription, finalPending })
    : resolveSelfFlowStep(site, { subscription })

  return { flowStep, visibility: visibilityFromFlowStep(flowStep) }
}

/**
 * 제작자 판별: 대리=본사 staff, 셀프=소유 고객
 * @param {'producer'|'partial'} visibility
 * @param {'self'|'managed'|string} buildType
 * @param {{ isStaff: boolean, isOwner: boolean }} who
 */
export function canViewByVisibility(visibility, buildType, who) {
  if (visibility === 'public') return true
  if (visibility === 'hidden') return false
  if (visibility === 'partial') return !!(who.isStaff || who.isOwner)
  // producer
  if (buildType === 'managed') return !!who.isStaff
  return !!who.isOwner
}
