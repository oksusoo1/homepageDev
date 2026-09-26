'use server'

import { requireOwnedSiteByCode } from '@/lib/server/guard'
import { onlyActive } from '@/lib/use-flag'
import { deploySite } from '@/lib/deploy'
import { getBillingReadiness, registerBankTransfer, assertPaymentSetupAllowed } from '@/lib/billing'
import {
  isResubscribeCharge,
  normalizeCardLast4,
  replaceCustomerCard,
  applyCardResubscribe,
} from '@/lib/payment/card-policy'

function ok(data) {
  return { ok: true, data }
}

function fail(error) {
  return { ok: false, error: error || '처리에 실패했습니다.' }
}

async function loadBillingContext(db, site) {
  const [{ data: card }, { data: sub }, inquiry] = await Promise.all([
    onlyActive(
      db.from('customer_payment_methods')
        .select('payment_method_id, card_name, card_last4')
        .eq('customer_id', site.customer_id)
    ).maybeSingle(),
    onlyActive(
      db.from('subscriptions').select('*').eq('site_id', site.site_id)
    ).maybeSingle(),
    site.inquiry_id
      ? onlyActive(
          db.from('inquiries').select('*').eq('inquiry_id', site.inquiry_id)
        ).maybeSingle().then(r => r.data)
      : Promise.resolve(null),
  ])
  return { card: card || null, sub: sub || null, inquiry }
}

function canDeployStatus(site, inquiry) {
  if (site.build_type === 'self') {
    return ['building', 'pay_method', 'preview'].includes(site.status)
  }
  return site.status === 'pay_method' && !!inquiry?.final_paid_at
}

async function runDeploy(db, { site, customerId }) {
  const { card, sub } = await loadBillingContext(db, site)
  const billing = getBillingReadiness(card, sub, site)
  if (!billing.ready) {
    return ok({ requireBillingSetup: true, trialEndsAt: null, siteStatus: site.status })
  }

  const result = await deploySite(db, {
    site,
    customerId,
    billingMethod: billing.method,
  })
  if (result.error) return fail(result.error)

  const { data: subscription } = await onlyActive(
    db.from('subscriptions').select('*').eq('site_id', site.site_id)
  ).maybeSingle()

  return ok({
    requireBillingSetup: !!result.requireBillingSetup,
    trialEndsAt: result.trialEndsAt,
    siteStatus: result.requireBillingSetup ? 'pay_method' : 'trial',
    card,
    subscription,
  })
}

/** 서비스 시작 */
export async function deploySiteAction(siteCode) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)

  const { db, site, customer } = gate
  const { inquiry } = await loadBillingContext(db, site)
  if (!canDeployStatus(site, inquiry)) {
    return fail('지금은 서비스를 시작할 수 없습니다.')
  }

  return runDeploy(db, { site, customerId: customer.customer_id })
}

/**
 * 카드 목업 등록. 서버에는 끝 4자리만.
 * 즉시 결제는 재구독(해지·정지)일 때만.
 */
export async function registerCardMockAction(siteCode, { cardLast4, alsoDeploy = false } = {}) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)

  const last4 = normalizeCardLast4(cardLast4)
  if (last4.length !== 4) return fail('카드 끝 4자리가 필요합니다.')

  const { db, site, customer } = gate
  const setup = await assertPaymentSetupAllowed(db, site.site_id)
  const { card, sub, inquiry } = await loadBillingContext(db, site)
  const resubscribe = isResubscribeCharge(site, sub)

  if (!setup.ok && !resubscribe) return fail(setup.error)
  if (site.build_type === 'managed' && !inquiry?.final_paid_at) {
    return fail('잔금 확인 후 결제 수단을 등록할 수 있습니다.')
  }

  const now = new Date()
  const billingKey = `MOCK_BILLING_${customer.customer_id}_${Date.now()}`

  try {
    await replaceCustomerCard(db, customer.customer_id, { billingKey, last4 })
  } catch (e) {
    return fail(e.message)
  }

  let charged = false
  if (resubscribe && sub) {
    try {
      await applyCardResubscribe(db, {
        site,
        sub,
        now,
        note: '[MOCK] 재구독 즉시 결제',
      })
      charged = true
    } catch (e) {
      return fail(e.message)
    }
  } else if (sub) {
    await db.from('subscriptions').update({
      payment_method: 'card',
      updated_at: now.toISOString(),
    }).eq('site_id', site.site_id)
  }

  if (alsoDeploy && !charged) {
    const fresh = await onlyActive(
      db.from('sites').select('*').eq('site_id', site.site_id)
    ).maybeSingle()
    const deploy = await runDeploy(db, {
      site: fresh.data || site,
      customerId: customer.customer_id,
    })
    if (!deploy.ok) return deploy
    return ok({ ...deploy.data, charged, cardLast4: last4, hadCard: !!card })
  }

  return ok({ charged, cardLast4: last4, requireBillingSetup: false })
}

/** 계좌이체 구독 등록 */
export async function registerBankTransferAction(siteCode, { depositorName, alsoDeploy = false } = {}) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)

  const { db, site, customer } = gate
  const reg = await registerBankTransfer(db, {
    siteId: site.site_id,
    depositorName,
  })
  if (reg.error) return fail(reg.error)

  if (alsoDeploy) {
    const { data: fresh } = await onlyActive(
      db.from('sites').select('*').eq('site_id', site.site_id)
    ).maybeSingle()
    return runDeploy(db, { site: fresh || site, customerId: customer.customer_id })
  }

  return ok({ requireBillingSetup: false })
}

/** 구독 해지 예약 — trial/subscribed만 */
export async function cancelSubscriptionAction(siteCode) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)

  const { db, site } = gate
  if (!['trial', 'subscribed'].includes(site.status)) {
    return fail('체험·구독 중에서만 해지할 수 있습니다.')
  }

  const { data: sub } = await onlyActive(
    db.from('subscriptions').select('*').eq('site_id', site.site_id)
  ).maybeSingle()
  if (!sub) return fail('구독 정보가 없습니다.')
  if (sub.cancelled_at || sub.cancels_at) return fail('이미 해지되었거나 해지 예약된 구독입니다.')

  const now = new Date().toISOString()
  const patch = {
    cancelled_at: now,
    cancels_at: sub.next_billing_date,
    next_billing_date: null,
  }
  const { error } = await db.from('subscriptions')
    .update(patch)
    .eq('subscription_id', sub.subscription_id)
  if (error) return fail(error.message)

  return ok({ ...sub, ...patch })
}

/** 해지 예약 철회 */
export async function reinstateSubscriptionAction(siteCode) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)

  const { db, site } = gate
  const { data: sub } = await onlyActive(
    db.from('subscriptions').select('*').eq('site_id', site.site_id)
  ).maybeSingle()
  if (!sub) return fail('구독 정보가 없습니다.')
  if (!sub.cancels_at) return fail('해지 예약이 없습니다.')

  const { error } = await db.from('subscriptions').update({
    cancelled_at: null,
    cancels_at: null,
  }).eq('subscription_id', sub.subscription_id)
  if (error) return fail(error.message)

  return ok({ ...sub, cancelled_at: null, cancels_at: null })
}
