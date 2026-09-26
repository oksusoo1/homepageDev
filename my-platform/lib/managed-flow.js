/**
 * 본사 대리(managed) 제작·구독 플로우
 * 진도 SSOT = sites.status (FLOW_STEP)
 */

import { onlyActive, softDelete, USE_FLAG_OFF } from '@/lib/use-flag'
import { isSiteFlowStep } from '@/lib/site-flow'

export function isManagedSite(site) {
  return site?.build_type === 'managed'
}

/** 잔금 확인 후 · sites.status 가 pay_method 이상 */
export function canStartManagedService(inquiry, site) {
  if (!inquiry?.final_paid_at) return false
  const st = site?.status
  return isSiteFlowStep(st) && ['pay_method', 'trial', 'subscribed'].includes(st)
}

export function canAccessPaymentSetup(site, inquiry) {
  if (!isManagedSite(site)) return true
  if (!inquiry?.final_paid_at) return false
  const st = site?.status
  return ['pay_method', 'trial', 'subscribed', 'suspended'].includes(st)
}

export function managedNeedsGoLive(site, inquiry) {
  if (!isManagedSite(site)) return false
  if (!canStartManagedService(inquiry, site)) return false
  if (site.trial_started_at) return false
  return site.status === 'pay_method'
}

export function isInReviewPhase(site) {
  return site?.status === 'preview' || site?.status === 'balance'
}

export function managedBlockedMessage(inquiry, site) {
  if (!inquiry) return '본사 제작 문의가 연결되지 않았습니다.'
  if (!inquiry.final_paid_at) return '잔금 확인 후 서비스를 시작할 수 있습니다.'
  if (!canStartManagedService(inquiry, site)) {
    return '카드/계좌 등록 단계가 되면 서비스를 시작할 수 있습니다.'
  }
  return null
}

/** 선금 확인 전만 취소 — down_paid_at 또는 flow>=building 이면 불가 */
export function canCancelManagedIntake(inquiry, site) {
  if (!inquiry?.inquiry_id) return false
  if (inquiry.down_paid_at) return false
  const st = site?.status
  if (isSiteFlowStep(st)) {
    const idx = ['intake', 'deposit', 'building', 'preview', 'balance', 'pay_method', 'trial', 'subscribed', 'suspended']
    return idx.indexOf(st) <= idx.indexOf('deposit')
  }
  return true
}

export async function cancelManagedIntake(supabase, inquiryId) {
  if (!inquiryId) throw new Error('inquiry_id가 필요합니다.')

  const { data: inq, error: inqErr } = await onlyActive(
    supabase
      .from('inquiries')
      .select('inquiry_id, down_paid_at, customer_id')
      .eq('inquiry_id', inquiryId)
  ).maybeSingle()
  if (inqErr) throw new Error(inqErr.message)
  if (!inq) throw new Error('문의를 찾을 수 없습니다.')
  if (inq.down_paid_at) throw new Error('선금 확인 후에는 접수 취소할 수 없습니다.')

  const { data: linkedSites, error: siteErr } = await onlyActive(
    supabase.from('sites').select('site_id, status').eq('inquiry_id', inquiryId)
  )
  if (siteErr) throw new Error(siteErr.message)

  const siteIds = (linkedSites || []).map(s => s.site_id)
  const now = new Date().toISOString()

  for (const siteId of siteIds) {
    const { error: sErr } = await supabase.from('sites').update({
      status: 'suspended',
      use_flag: USE_FLAG_OFF,
      updated_at: now,
    }).eq('site_id', siteId)
    if (sErr) throw new Error(sErr.message)

    const { data: subs } = await onlyActive(
      supabase.from('subscriptions').select('subscription_id').eq('site_id', siteId)
    )
    for (const sub of subs || []) {
      await softDelete(supabase, 'subscriptions', 'subscription_id', sub.subscription_id)
    }

    const { error: otpErr } = await supabase.from('one_time_payments')
      .update({ use_flag: USE_FLAG_OFF })
      .eq('site_id', siteId)
      .eq('use_flag', 1)
    if (otpErr) throw new Error(otpErr.message)
  }

  await softDelete(supabase, 'inquiries', 'inquiry_id', inquiryId)
}
