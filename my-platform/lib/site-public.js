import { supabase } from '@/lib/supabase'
import { onlyActive } from '@/lib/use-flag'

const VISITOR_STATUSES = ['published', 'suspended', 'review']

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
 * 방문자용 사이트 조회 (published / suspended / review)
 */
export async function getVisitorSite(siteCode) {
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
    return { ...site, status: 'suspended' }
  }

  return site
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
