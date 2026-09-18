import { supabase } from '@/lib/supabase'
import { onlyActive } from '@/lib/use-flag'
import { resolveSiteVisibility } from '@/lib/site-visibility'
import { FLOW_STEPS } from '@/lib/flow-step'

/** 공개 URL — FLOW_STEP 전부 (게이트에서 가림) */
const VISITOR_STATUSES = [...FLOW_STEPS]

/**
 * URL 식별자(subdomain 또는 site_code)로 사이트 조회
 */
export async function getSiteByCode(siteCode) {
  if (!siteCode) return null

  let { data } = await onlyActive(
    supabase.from('sites').select('*').eq('subdomain', siteCode)
  ).maybeSingle()

  if (!data) {
    ;({ data } = await onlyActive(
      supabase.from('sites').select('*').eq('site_code', siteCode)
    ).maybeSingle())
  }

  return data
}

/**
 * 방문자용 번들: site + inquiry + visibility
 */
export async function getVisitorSiteBundle(siteCode) {
  const site = await getSiteByCode(siteCode)
  if (!site || !VISITOR_STATUSES.includes(site.status)) return null

  const { data: sub } = await onlyActive(
    supabase
      .from('subscriptions')
      .select('subscription_id, cancels_at, cancelled_at')
      .eq('site_id', site.site_id)
  ).maybeSingle()

  if (sub?.cancels_at && new Date(sub.cancels_at) <= new Date() && !sub.cancelled_at) {
    const now = new Date().toISOString()
    await supabase.from('subscriptions')
      .update({ cancelled_at: now, updated_at: now })
      .eq('subscription_id', sub.subscription_id)
    await supabase.from('sites')
      .update({ status: 'suspended', updated_at: now })
      .eq('site_id', site.site_id)
    const suspended = { ...site, status: 'suspended' }
    const endedSub = { ...sub, cancelled_at: now }
    return {
      site: suspended,
      inquiry: null,
      subscription: endedSub,
      ...resolveSiteVisibility(suspended),
    }
  }

  let inquiry = null
  if (site.inquiry_id) {
    const { data } = await onlyActive(
      supabase.from('inquiries').select('*').eq('inquiry_id', site.inquiry_id)
    ).maybeSingle()
    inquiry = data
  }

  let finalPending = false
  if (
    inquiry?.customer_id
    && !inquiry?.final_paid_at
    && (site.status === 'preview' || site.status === 'balance')
  ) {
    const { data: otp } = await onlyActive(
      supabase
        .from('one_time_payments')
        .select('payment_id')
        .eq('customer_id', inquiry.customer_id)
        .eq('type', 'dev_fee')
        .eq('status', 'pending_confirm')
        .limit(1)
    )
    finalPending = !!(otp && otp.length)
  }

  const { flowStep, visibility } = resolveSiteVisibility(site, {
    inquiry,
    subscription: sub,
    finalPending,
  })

  return { site, inquiry, subscription: sub, flowStep, visibility }
}

export async function getVisitorSite(siteCode) {
  const bundle = await getVisitorSiteBundle(siteCode)
  return bundle?.site || null
}

/** @deprecated getVisitorSite 사용 */
export async function getPublicSite(siteCode) {
  return getVisitorSite(siteCode)
}

/**
 * 레거시 /preview/[domain] → siteCode 변환용
 */
export async function resolveSiteCodeFromDomain(domain) {
  const subdomain = domain.split('.')[0]

  let { data } = await onlyActive(
    supabase.from('sites').select('subdomain').eq('domain', domain)
  ).maybeSingle()

  if (!data) {
    ;({ data } = await onlyActive(
      supabase.from('sites').select('subdomain').eq('subdomain', subdomain)
    ).maybeSingle())
  }

  return data?.subdomain || null
}
