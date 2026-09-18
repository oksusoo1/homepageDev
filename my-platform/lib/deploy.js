import { supabase } from '@/lib/supabase'
import { canStartManagedService, isManagedSite } from '@/lib/managed-flow'
import { onlyActive } from '@/lib/use-flag'
import { setSiteFlow } from '@/lib/site-flow'

/**
 * 서비스 시작 → sites.status = trial
 */
export async function deploySite(siteId, customerId, existingSubscription, site, billingMethod = 'card') {
  const now = new Date()

  if (isManagedSite(site)) {
    if (!site?.inquiry_id) {
      return { error: '본사 제작 문의가 연결되지 않았습니다.', trialEndsAt: null, requireBillingSetup: false }
    }
    const { data: inquiry } = await onlyActive(
      supabase
        .from('inquiries')
        .select('inquiry_id, final_paid_at')
        .eq('inquiry_id', site.inquiry_id)
    ).single()
    if (!canStartManagedService(inquiry, site)) {
      return { error: '잔금 확인 후 서비스를 시작할 수 있습니다.', trialEndsAt: null, requireBillingSetup: false }
    }
  }

  const trialAlreadyUsed = !!site?.trial_started_at

  if (trialAlreadyUsed) {
    try {
      await setSiteFlow(supabase, siteId, 'pay_method')
    } catch (e) {
      return { error: e.message, trialEndsAt: null, requireBillingSetup: true }
    }
    return { error: null, trialEndsAt: null, requireBillingSetup: true }
  }

  const trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const trialEndsDate = trialEnds.toISOString().split('T')[0]

  const billingDraft = site?.content?._billing_draft
  const content = { ...(site?.content || {}) }
  delete content._billing_draft

  try {
    await setSiteFlow(supabase, siteId, 'trial', {
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      content,
    })
  } catch (e) {
    return { error: e.message, trialEndsAt: null, requireBillingSetup: false }
  }

  const subPayload = {
    payment_method: billingMethod,
    next_billing_date: trialEndsDate,
    updated_at: now.toISOString(),
    ...(billingMethod === 'manual' && billingDraft ? {
      depositor_name: billingDraft.depositor_name,
      bank_transfer_agreed_at: billingDraft.bank_transfer_agreed_at,
    } : {}),
  }

  if (!existingSubscription) {
    const { error: subError } = await supabase.from('subscriptions').insert({
      customer_id: customerId,
      site_id: siteId,
      amount: 30000,
      billing_day: 1,
      ...subPayload,
    })
    if (subError) return { error: subError.message, trialEndsAt: null, requireBillingSetup: false }
  } else {
    const { error: subError } = await supabase
      .from('subscriptions')
      .update({ ...subPayload })
      .eq('site_id', siteId)
    if (subError) return { error: subError.message, trialEndsAt: null, requireBillingSetup: false }
  }

  return { error: null, trialEndsAt: trialEnds.toISOString(), requireBillingSetup: false }
}
