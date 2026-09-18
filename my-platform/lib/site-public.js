import { supabase } from '@/lib/supabase'
import { onlyActive } from '@/lib/use-flag'
import { resolveSiteVisibility } from '@/lib/site-visibility'

/** 공개 URL에서 다룰 status (admin 제외) */
const VISITOR_STATUSES = ['draft', 'review', 'published', 'suspended', 'cancelled']

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
 * 방문자용 번들: site + inquiry + subscription + visibility
 * draft/review 도 포함 (게이트에서 누가 볼지 결정)
 */
export async function getVisitorSiteBundle(siteCode) {
  const site = await getSiteByCode(siteCode)
  if (!site || !VISITOR_STATUSES.includes(site.status)) return null

  const { data: sub } = await onlyActive(
    supabase
      .from('subscriptions')
      .select('subscription_id, cancels_at, status')
      .eq('site_id', site.site_id)
  ).maybeSingle()

  if (sub?.cancels_at && new Date(sub.cancels_at) <= new Date() && sub.status !== 'cancelled') {
    await supabase.from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('subscription_id', sub.subscription_id)
    await supabase.from('sites')
      .update({ status: 'suspended', updated_at: new Date().toISOString() })
      .eq('site_id', site.site_id)
    const suspended = { ...site, status: 'suspended' }
    return {
      site: suspended,
      inquiry: null,
      subscription: null,
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
  if (inquiry?.customer_id && inquiry?.status === 'review' && !inquiry?.final_paid_at) {
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

/**
 * 방문자용 사이트 조회 (호환)
 */
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
