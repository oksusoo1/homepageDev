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

  // 해지일 도래 — 쓰기는 청구 배치. 여기선 hidden 표시만
  if (sub?.cancels_at && new Date(sub.cancels_at) <= new Date() && !sub.cancelled_at) {
    const suspended = { ...site, status: 'suspended' }
    return {
      site: suspended,
      inquiry: null,
      subscription: sub,
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
