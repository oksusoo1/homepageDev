/**
 * 카드 등록 정책
 * - 고객당 활성 카드 1장 (새 등록 시 기존 use_flag=0)
 * - 즉시 결제는 재구독(해지·정지)일 때만
 */

import { USE_FLAG_OFF } from '@/lib/use-flag'

export function isResubscribeCharge(site, sub) {
  return !!(sub?.cancelled_at || site?.status === 'suspended')
}

export function addOneMonthYmd(now = new Date()) {
  const d = new Date(now)
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().split('T')[0]
}

export function normalizeCardLast4(value) {
  return String(value || '').replace(/\D/g, '').slice(-4)
}

export async function replaceCustomerCard(db, customerId, {
  billingKey,
  last4,
  brand = '테스트카드',
  name = '개인',
}) {
  await db.from('customer_payment_methods')
    .update({ use_flag: USE_FLAG_OFF })
    .eq('customer_id', customerId)
    .eq('use_flag', 1)

  const { error } = await db.from('customer_payment_methods').insert({
    customer_id: customerId,
    pg_provider: 'toss',
    pg_customer_id: billingKey,
    card_last4: last4,
    card_brand: brand,
    card_name: name,
  })
  if (error) throw new Error(error.message)
}

/**
 * 재구독 즉시 1개월분. 금액은 subscriptions.amount
 */
export async function applyCardResubscribe(db, { site, sub, now, pgTransactionId, note }) {
  const amount = sub.amount || 30000
  const iso = now.toISOString()
  const nextBillingDate = addOneMonthYmd(now)

  const { error: subErr } = await db.from('subscriptions').update({
    payment_method: 'card',
    cancelled_at: null,
    cancels_at: null,
    updated_at: iso,
    next_billing_date: nextBillingDate,
  }).eq('site_id', site.site_id)
  if (subErr) throw new Error(subErr.message)

  const { error: siteErr } = await db.from('sites').update({
    status: 'subscribed',
    updated_at: iso,
  }).eq('site_id', site.site_id)
  if (siteErr) throw new Error(siteErr.message)

  const period = iso.slice(0, 7)
  const { error: billErr } = await db.from('billing_history').upsert({
    subscription_id: sub.subscription_id,
    period,
    amount,
    status: 'paid',
    payment_method: 'card',
    paid_at: iso,
    note,
    ...(pgTransactionId ? { pg_transaction_id: pgTransactionId } : {}),
  }, { onConflict: 'subscription_id,period' })
  if (billErr) throw new Error(billErr.message)

  return { charged: true, amount, nextBillingDate }
}
