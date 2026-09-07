/**
 * 구독 청구 배치 (목업)
 * - 자동 cron 없음 → DevTools/API 수동 실행
 * - asOfDate: 가상 "오늘" (YYYY-MM-DD)
 *
 * 카드: next_billing_date 다음날부터 결제 MOCK → billing_history paid, trial→active
 * 계좌: D-5~D-day 매일 리마인드 로그 / 미납 +2일 초과 시 사이트 suspended
 */

import { supabase } from '@/lib/supabase'
import { onlyActive } from '@/lib/use-flag'

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

async function logNotification({ type, siteId, customerId, subscriptionId, asOfDate, payload }) {
  const { error } = await supabase.from('notification_logs').insert({
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

/**
 * @param {{ asOfDate?: string }} opts asOfDate 기본=실제 오늘
 * @returns {Promise<{ asOfDate: string, actions: object[] }>}
 */
export async function runBillingBatch({ asOfDate } = {}) {
  const asOf = asOfDate || formatDate(new Date())
  const actions = []

  const { data: subs, error } = await onlyActive(
    supabase
      .from('subscriptions')
      .select('*, sites(site_id, name, subdomain, status, customer_id)')
      .in('status', ['trial', 'active'])
      .not('next_billing_date', 'is', null)
  )

  if (error) throw error

  for (const sub of subs || []) {
    const site = Array.isArray(sub.sites) ? sub.sites[0] : sub.sites
    if (!site || site.status === 'cancelled') continue

    const due = String(sub.next_billing_date).slice(0, 10)
    const method = sub.payment_method // card | manual

    if (method === 'card') {
      await runCardTask({ sub, site, due, asOf, actions })
    } else if (method === 'manual') {
      await runBankTasks({ sub, site, due, asOf, actions })
    }
  }

  return { asOfDate: asOf, actions, count: actions.length }
}

async function runCardTask({ sub, site, due, asOf, actions }) {
  // trial/청구일 다음날부터 결제
  const chargeFrom = addDays(due, 1)
  if (asOf < chargeFrom) return

  const period = periodFromDate(due)

  const { data: existing } = await onlyActive(
    supabase
      .from('billing_history')
      .select('billing_id, status')
      .eq('subscription_id', sub.subscription_id)
      .eq('period', period)
  ).maybeSingle()

  if (existing?.status === 'paid') return

  const now = new Date().toISOString()
  const amount = sub.amount || 30000

  if (existing) {
    const { error } = await supabase.from('billing_history').update({
      status: 'paid',
      payment_method: 'card',
      paid_at: now,
      pg_transaction_id: `MOCK-CARD-${period}`,
      note: `배치 목업 카드결제 (asOf=${asOf})`,
    }).eq('billing_id', existing.billing_id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('billing_history').insert({
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
  const { error: subErr } = await supabase.from('subscriptions').update({
    status: 'active',
    next_billing_date: nextDue,
    updated_at: now,
  }).eq('subscription_id', sub.subscription_id)
  if (subErr) throw subErr

  const logged = await logNotification({
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

async function runBankTasks({ sub, site, due, asOf, actions }) {
  const daysUntilDue = -diffDays(asOf, due) // due - asOf: 양수면 아직 남음
  const daysPastDue = diffDays(asOf, due)   // asOf - due

  const period = periodFromDate(due)
  const { data: bill } = await onlyActive(
    supabase
      .from('billing_history')
      .select('billing_id, status')
      .eq('subscription_id', sub.subscription_id)
      .eq('period', period)
  ).maybeSingle()

  const paid = bill?.status === 'paid'

  // D-5 ~ D-day 리마인드 (미납일 때)
  if (!paid && daysUntilDue >= 0 && daysUntilDue <= 5) {
    const logged = await logNotification({
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
      const { error } = await supabase.from('sites').update({
        status: 'suspended',
        updated_at: new Date().toISOString(),
      }).eq('site_id', site.site_id)
      if (error) throw error
    }

    const { error: subErr } = await supabase.from('subscriptions').update({
      status: 'paused',
      updated_at: new Date().toISOString(),
    }).eq('subscription_id', sub.subscription_id)
    if (subErr) throw subErr

    const logged = await logNotification({
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
