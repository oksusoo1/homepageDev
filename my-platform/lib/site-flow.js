/**
 * sites.status = FLOW_STEP (진도 SSOT)
 * 공개 범위·화면 진도는 전부 이 컬럼.
 */

import { FLOW_STEPS, flowStepLabel } from '@/lib/flow-step'

const FLOW_SET = new Set(FLOW_STEPS)

/** @param {string|null|undefined} code */
export function isSiteFlowStep(code) {
  return !!code && FLOW_SET.has(code)
}

/** site.status 가 곧 FLOW */
export function siteFlow(site) {
  const s = site?.status
  return isSiteFlowStep(s) ? s : null
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} siteId
 * @param {string} flowStep
 * @param {object} [extra] 추가 sites 컬럼
 */
export async function setSiteFlow(supabase, siteId, flowStep, extra = {}) {
  if (!isSiteFlowStep(flowStep)) {
    throw new Error(`잘못된 FLOW_STEP: ${flowStep}`)
  }
  const { error } = await supabase
    .from('sites')
    .update({
      status: flowStep,
      updated_at: new Date().toISOString(),
      ...extra,
    })
    .eq('site_id', siteId)
    .eq('use_flag', 1)
  if (error) throw new Error(error.message)
}

export function siteFlowLabel(site, fallback) {
  const f = siteFlow(site)
  return f ? flowStepLabel(f) : (fallback ?? '—')
}

/** 공개 범위용 — building=제작자만, preview|balance=부분, pay_method~=공개, suspended=미공개 */
export function visibilityFromSite(site) {
  const f = siteFlow(site)
  if (!f || f === 'suspended') return 'hidden'
  if (f === 'intake' || f === 'deposit' || f === 'building') return 'producer'
  if (f === 'preview' || f === 'balance') return 'partial'
  return 'public'
}
