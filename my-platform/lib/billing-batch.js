/**
 * 구독 청구 배치 (목업)
 * - 자동 cron 없음 → DevTools/API 수동 실행
 * - asOfDate: 가상 "오늘" (YYYY-MM-DD)
 *
 * 카드: next_billing_date 다음날부터 결제 MOCK → billing_history paid, sites→subscribed
 * 계좌: D-5~D-day 매일 리마인드 로그 / 미납 +2일 초과 시 sites→suspended
 * 청구 대상: sites.status trial|subscribed + cancelled_at NULL
 * 해지 예정일 도래(cancels_at ≤ asOf, cancelled_at NULL) → cancelled_at + sites.suspended
 * 탈퇴 예약일 도래(withdraw_at ≤ asOf) → 사이트 suspended · customers.withdrawn
 */

import { onlyActive } from '@/lib/use-flag'
import { isBillableSubscription } from '@/lib/subscription-life'

function parseDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(ymd, n) {
  const d = parseDate(ymd)
  d.setDate(d.getDate() + n)
  return formatDate(d)
}

function addMonths(ymd, n) {
  const d = parseDate(ymd)
  d.setMonth(d.getMonth() + n)
  return formatDate(d)
}

/** asOf - target 일수 (양수면 asOf가 target보다 뒤) */
function diffDays(asOf, target) {
  const a = parseDate(asOf).getTime()
  const t = parseDate(target).getTime()
  return Math.round((a - t) / (24 * 60 * 60 * 1000))
}

function periodFromDate(ymd) {
  return ymd.slice(0, 7) // YYYY-MM
}

async function logNotification(db, { type, siteId, customerId, subscriptionId, asOfDate, payload }) {
  const { error } = await db.from('notification_logs').insert({
    type,
    channel: 'mock_alimtalk',
    site_id: siteId,
    customer_id: customerId,
    subscription_id: subscriptionId,
    as_of_date: asOfDate,
    payload,
  })
  // unique 충돌 = 오늘 이미 보냄 → 스킵
  if (error && error.code !== '23505') throw error
  return !error
}

function cancelDateYmd(sub) {
  if (!sub?.cancels_at) return null
  return String(sub.cancels_at).slice(0, 10)
}

/** 해지 예정일 당일·이후 — 청구·리마인드 제외 */
function isPastCancelDate(sub, asOf) {
  const due = cancelDateYmd(sub)
  return !!due && due <= asOf
}

function normalizeSiteIds(siteIds) {
  if (!Array.isArray(siteIds) || siteIds.length === 0) return null
  const ids = [...new Set(siteIds.map(id => String(id || '').trim()).filter(Boolean))]
  return ids.length ? ids : null
}

function withSiteIds(query, siteIds) {
  return siteIds ? query.in('site_id', siteIds) : query
}

/**
 * @param {{ asOfDate?: string, client: object, siteIds?: string[] }} opts
 *   asOfDate 기본=실제 오늘. client 필수(admin). siteIds 있으면 그 사이트만
 * @returns {Promise<{ asOfDate: string, actions: object[] }>}
 */
export async function runBillingBatch({ asOfDate, client, siteIds } = {}) {
  if (!client) throw new Error('runBillingBatch: client(admin) 가 필요합니다.')
  const db = client
  const asOf = asOfDate || formatDate(new Date())
  const onlySites = normalizeSiteIds(siteIds)
  const actions = []

  // 1) 해지 예정일 도래부터 — 이후 청구 조회가 최신 cancelled_at/status를 보게
  await applyDueCancellations(db, asOf, actions, onlySites)
  await applyDueWithdrawals(db, asOf, actions, onlySites)

  const { data: subs, error } = await onlyActive(
    withSiteIds(
      db
        .from('subscriptions')
        .select('*, sites(site_id, name, subdomain, status, customer_id)')
        .is('cancelled_at', null)
        .not('next_billing_date', 'is', null),
      onlySites,
    )
  )

  if (error) throw error

  for (const sub of subs || []) {
    if (isPastCancelDate(sub, asOf)) continue
    const site = Array.isArray(sub.sites) ? sub.sites[0] : sub.sites
    if (!isBillableSubscription(site, sub)) continue

    const due = String(sub.next_billing_date).slice(0, 10)
    const method = sub.payment_method // card | manual

    if (method === 'card') {
      await runCardTask(db, { sub, site, due, asOf, actions })
    } else if (method === 'manual') {
      await runBankTasks(db, { sub, site, due, asOf, actions })
    }
  }

  return { asOfDate: asOf, actions, count: actions.length }
}

/**
 * 해지 예정일 도래 → cancelled_at 없으면 기록 + sites.suspended
 */
async function applyDueCancellations(db, asOf, actions, siteIds = null) {
  const { data: dueSubs, error } = await onlyActive(
    withSiteIds(
      db
        .from('subscriptions')
        .select('subscription_id, cancels_at, cancelled_at, site_id, sites(site_id, name, subdomain, status)')
        .not('cancels_at', 'is', null),
      siteIds,
    )
  )
  if (error) throw error

  for (const sub of dueSubs || []) {
    const due = cancelDateYmd(sub)
    if (!due || due > asOf) continue

    const site = Array.isArray(sub.sites) ? sub.sites[0] : sub.sites
    const now = new Date().toISOString()
    const alreadyEnded = !!sub.cancelled_at && site?.status === 'suspended'
    if (alreadyEnded) continue

    if (!sub.cancelled_at) {
      const { error: subErr } = await db.from('subscriptions').update({
        cancelled_at: now,
        updated_at: now,
      }).eq('subscription_id', sub.subscription_id)
      if (subErr) throw subErr
    }

    if (site?.site_id && site.status !== 'suspended') {
      const { error: siteErr } = await db.from('sites').update({
        status: 'suspended',
        updated_at: now,
      }).eq('site_id', site.site_id)
      if (siteErr) throw siteErr
    }

    actions.push({
      task: 'cancel_due',
      subscription_id: sub.subscription_id,
      site: site?.subdomain,
      cancels_at: due,
    })
  }
}

/**
 * withdraw_at 도래 → 해당 고객의 사이트 정지 + customers.withdrawn
 * siteIds 있으면 그 사이트의 고객만 (처리 값은 고객 단위, 기존 /my 확정과 동일)
 */
async function applyDueWithdrawals(db, asOf, actions, siteIds = null) {
  let customerIds = null
  if (siteIds) {
    const { data: sites, error } = await onlyActive(
      db.from('sites').select('customer_id').in('site_id', siteIds)
    )
    if (error) throw error
    customerIds = [...new Set((sites || []).map(s => s.customer_id).filter(Boolean))]
    if (!customerIds.length) return
  }

  let q = onlyActive(
    db.from('customers').select('customer_id, withdraw_at, status').not('withdraw_at', 'is', null)
  )
  if (customerIds) q = q.in('customer_id', customerIds)
  const { data: customers, error } = await q
  if (error) throw error

  for (const cust of customers || []) {
    const due = String(cust.withdraw_at).slice(0, 10)
    if (!due || due > asOf) continue

    const { data: sites, error: siteErr } = await onlyActive(
      db.from('sites').select('site_id').eq('customer_id', cust.customer_id)
    )
    if (siteErr) throw siteErr
    const ids = (sites || []).map(s => s.site_id)
    if (ids.length) {
      const { error: susErr } = await db.from('sites')
        .update({ status: 'suspended' })
        .in('site_id', ids)
        .eq('use_flag', 1)
      if (susErr) throw susErr
    }
    const { error: custErr } = await db.from('customers')
      .update({ status: 'withdrawn', withdraw_at: null })
      .eq('customer_id', cust.customer_id)
    if (custErr) throw custErr

    actions.push({
      task: 'withdraw_due',
      customer_id: cust.customer_id,
      site_ids: ids,
      withdraw_at: due,
    })
  }
}

async function runCardTask(db, { sub, site, due, asOf, actions }) {
  // trial/청구일 다음날부터 결제
  const chargeFrom = addDays(due, 1)
  if (asOf < chargeFrom) return

  const period = periodFromDate(due)

  const { data: existing } = await onlyActive(
    db
      .from('billing_history')
      .select('billing_id, status')
      .eq('subscription_id', sub.subscription_id)
      .eq('period', period)
  ).maybeSingle()

  if (existing?.status === 'paid') return

  const now = new Date().toISOString()
  const amount = sub.amount || 30000

  if (existing) {
    const { error } = await db.from('billing_history').update({
      status: 'paid',
      payment_method: 'card',
      paid_at: now,
      pg_transaction_id: `MOCK-CARD-${period}`,
      note: `배치 목업 카드결제 (asOf=${asOf})`,
    }).eq('billing_id', existing.billing_id)
    if (error) throw error
  } else {
    const { error } = await db.from('billing_history').insert({
      subscription_id: sub.subscription_id,
      period,
      amount,
      status: 'paid',
      payment_method: 'card',
      paid_at: now,
      pg_transaction_id: `MOCK-CARD-${period}`,
      note: `배치 목업 카드결제 (asOf=${asOf})`,
    })
    if (error) throw error
  }

  const nextDue = addMonths(due, 1)
  const { error: subErr } = await db.from('subscriptions').update({
    next_billing_date: nextDue,
    updated_at: now,
  }).eq('subscription_id', sub.subscription_id)
  if (subErr) throw subErr

  if (site.status !== 'subscribed') {
    const { error: siteErr } = await db.from('sites').update({
      status: 'subscribed',
      updated_at: now,
    }).eq('site_id', site.site_id)
    if (siteErr) throw siteErr
  }

  const logged = await logNotification(db, {
    type: 'card_charged',
    siteId: site.site_id,
    customerId: site.customer_id || sub.customer_id,
    subscriptionId: sub.subscription_id,
    asOfDate: asOf,
    payload: { period, amount, mock: true, site: site.subdomain },
  })

  actions.push({
    task: 'card_charge',
    subscription_id: sub.subscription_id,
    site: site.subdomain,
    period,
    amount,
    next_billing_date: nextDue,
    notified: logged,
  })
}

async function runBankTasks(db, { sub, site, due, asOf, actions }) {
  const daysUntilDue = -diffDays(asOf, due) // due - asOf: 양수면 아직 남음
  const daysPastDue = diffDays(asOf, due)   // asOf - due

  const period = periodFromDate(due)
  const { data: bill } = await onlyActive(
    db
      .from('billing_history')
      .select('billing_id, status')
      .eq('subscription_id', sub.subscription_id)
      .eq('period', period)
  ).maybeSingle()

  const paid = bill?.status === 'paid'

  // D-5 ~ D-day 리마인드 (미납일 때)
  if (!paid && daysUntilDue >= 0 && daysUntilDue <= 5) {
    const logged = await logNotification(db, {
      type: 'bank_remind',
      siteId: site.site_id,
      customerId: site.customer_id || sub.customer_id,
      subscriptionId: sub.subscription_id,
      asOfDate: asOf,
      payload: {
        mock: true,
        days_until_due: daysUntilDue,
        due,
        message: `[목업 알림톡] ${site.name || site.subdomain} 월 구독료 입금 안내 (D-${daysUntilDue})`,
      },
    })
    actions.push({
      task: 'bank_remind',
      subscription_id: sub.subscription_id,
      site: site.subdomain,
      days_until_due: daysUntilDue,
      notified: logged,
    })
  }

  // 미납 +2일 초과 → 정지
  if (!paid && daysPastDue > 2) {
    if (site.status !== 'suspended') {
      const { error } = await db.from('sites').update({
        status: 'suspended',
        updated_at: new Date().toISOString(),
      }).eq('site_id', site.site_id)
      if (error) throw error
    }

    const logged = await logNotification(db, {
      type: 'bank_suspend',
      siteId: site.site_id,
      customerId: site.customer_id || sub.customer_id,
      subscriptionId: sub.subscription_id,
      asOfDate: asOf,
      payload: {
        mock: true,
        days_past_due: daysPastDue,
        due,
        message: `[목업 알림톡] ${site.name || site.subdomain} 미납으로 사이트가 정지되었습니다`,
      },
    })

    actions.push({
      task: 'bank_suspend',
      subscription_id: sub.subscription_id,
      site: site.subdomain,
      days_past_due: daysPastDue,
      notified: logged,
    })
  }
}

export function todayYmd() {
  return formatDate(new Date())
}

export { addDays, formatDate }
