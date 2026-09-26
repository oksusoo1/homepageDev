import 'server-only'
import { canStartManagedService, isManagedSite } from '@/lib/managed-flow'
import { onlyActive } from '@/lib/use-flag'
import { setSiteFlow } from '@/lib/site-flow-write'
import { calcTrialWindow } from '@/lib/trial'

/**
 * 서비스 시작 → sites.status = trial
 * 호출 전 서버 Action에서 소유권·단계·결제수단을 검사한다.
 */
export async function deploySite(db, { site, customerId, billingMethod = 'card' }) {
  const siteId = site.site_id
  const now = new Date()

  if (isManagedSite(site)) {
    if (!site?.inquiry_id) {
      return { error: '본사 제작 문의가 연결되지 않았습니다.', trialEndsAt: null, requireBillingSetup: false }
    }
    const { data: inquiry } = await onlyActive(
      db
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
      await setSiteFlow(db, siteId, 'pay_method')
    } catch (e) {
      return { error: e.message, trialEndsAt: null, requireBillingSetup: true }
    }
    return { error: null, trialEndsAt: null, requireBillingSetup: true }
  }

  const { trialStartedAt, trialEndsAt, nextBillingDate } = calcTrialWindow(now)

  const billingDraft = site?.content?._billing_draft
  const content = { ...(site?.content || {}) }
  delete content._billing_draft

  try {
    await setSiteFlow(db, siteId, 'trial', {
      trial_started_at: trialStartedAt,
      trial_ends_at: trialEndsAt,
      content,
    })
  } catch (e) {
    return { error: e.message, trialEndsAt: null, requireBillingSetup: false }
  }

  const { data: existingSubscription } = await onlyActive(
    db.from('subscriptions').select('*').eq('site_id', siteId)
  ).maybeSingle()

  const subPayload = {
    payment_method: billingMethod,
    next_billing_date: nextBillingDate,
    updated_at: now.toISOString(),
    ...(billingMethod === 'manual' && billingDraft ? {
      depositor_name: billingDraft.depositor_name,
      bank_transfer_agreed_at: billingDraft.bank_transfer_agreed_at,
    } : {}),
  }

  if (!existingSubscription) {
    const { error: subError } = await db.from('subscriptions').insert({
      customer_id: customerId,
      site_id: siteId,
      amount: 30000,
      billing_day: 1,
      ...subPayload,
    })
    if (subError) return { error: subError.message, trialEndsAt: null, requireBillingSetup: false }
  } else {
    const { error: subError } = await db
      .from('subscriptions')
      .update({ ...subPayload })
      .eq('site_id', siteId)
    if (subError) return { error: subError.message, trialEndsAt: null, requireBillingSetup: false }
  }

  return { error: null, trialEndsAt, requireBillingSetup: false }
}
