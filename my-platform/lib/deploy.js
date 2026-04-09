import { supabase } from '@/lib/supabase'

/**
 * 사이트 배포 처리
 * - sites.status → published, deploy_status → live
 * - trial 14일 설정
 * - 구독 자동 생성 또는 trial로 업데이트
 *
 * @param {string} siteId - site UUID
 * @param {string} customerId - customer UUID
 * @param {object|null} existingSubscription - 기존 구독 (없으면 null)
 * @returns {{ error: string|null, trialEndsAt: string|null }}
 */
export async function deploySite(siteId, customerId, existingSubscription) {
  const now = new Date()
  const trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const nextBilling = new Date(trialEnds)
  nextBilling.setMonth(nextBilling.getMonth() + 1)
  nextBilling.setDate(1)

  // 1. 사이트 상태 업데이트
  const { error: siteError } = await supabase.from('sites')
    .update({
      status: 'published',
      deploy_status: 'live',
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('site_id', siteId)

  if (siteError) return { error: siteError.message, trialEndsAt: null }

  // 2. 구독 생성 또는 업데이트
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
    if (subError) return { error: subError.message, trialEndsAt: null }
  } else {
    const { error: subError } = await supabase.from('subscriptions')
      .update({
        status: 'trial',
        next_billing_date: nextBilling.toISOString().split('T')[0],
      })
      .eq('site_id', siteId)
    if (subError) return { error: subError.message, trialEndsAt: null }
  }

  return { error: null, trialEndsAt: trialEnds.toISOString() }
}
