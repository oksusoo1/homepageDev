import { supabase } from '@/lib/supabase'

/**
 * 사이트 배포 처리
 * - trial 최초 1회만 제공 (site.trial_started_at 기준)
 * - trial 재사용 시: 배포만 처리, 카드 등록 요구 (requireCard: true)
 *
 * @param {string} siteId
 * @param {string} customerId
 * @param {object|null} existingSubscription
 * @param {object} site - sites 행 (trial_started_at 확인용)
 * @returns {{ error: string|null, trialEndsAt: string|null, requireCard: boolean }}
 */
export async function deploySite(siteId, customerId, existingSubscription, site) {
  const now = new Date()
  const trialAlreadyUsed = !!site?.trial_started_at

  // ── Trial 재사용 불가: 배포만 처리 ──
  if (trialAlreadyUsed) {
    const { error: siteError } = await supabase.from('sites')
      .update({ status: 'published', deploy_status: 'live', updated_at: now.toISOString() })
      .eq('site_id', siteId)
    if (siteError) return { error: siteError.message, trialEndsAt: null, requireCard: false }
    return { error: null, trialEndsAt: null, requireCard: true }
  }

  // ── 최초 배포: trial 14일 설정 ──
  const trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const nextBilling = new Date(trialEnds)
  nextBilling.setMonth(nextBilling.getMonth() + 1)

  const { error: siteError } = await supabase.from('sites')
    .update({
      status: 'published',
      deploy_status: 'live',
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('site_id', siteId)

  if (siteError) return { error: siteError.message, trialEndsAt: null, requireCard: false }

  if (!existingSubscription) {
    const { error: subError } = await supabase.from('subscriptions').insert({
      customer_id: customerId,
      site_id: siteId,
      amount: 30000,
      billing_day: 1,
      payment_method: 'manual',
      status: 'trial',
      next_billing_date: nextBilling.toISOString().split('T')[0],
    })
    if (subError) return { error: subError.message, trialEndsAt: null, requireCard: false }
  } else {
    const { error: subError } = await supabase.from('subscriptions')
      .update({ status: 'trial', next_billing_date: nextBilling.toISOString().split('T')[0] })
      .eq('site_id', siteId)
    if (subError) return { error: subError.message, trialEndsAt: null, requireCard: false }
  }

  return { error: null, trialEndsAt: trialEnds.toISOString(), requireCard: false }
}
