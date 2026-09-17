/**
 * 본사 대리(managed) 제작·구독 플로우 (v1.3.2)
 *
 * 제작(inquiries) → 검수(review) → 잔금(approved) → 서비스 시작 → trial/active
 * 월 구독·next_billing_date는 서비스 시작 시점에만 생성
 */

import { onlyActive, softDelete, USE_FLAG_OFF } from '@/lib/use-flag'

export function isManagedSite(site) {
  return site?.build_type === 'managed'
}

/** 잔금 확인 후 월 구독·결제 수단 등록 가능 */
export function canStartManagedService(inquiry) {
  return !!(inquiry?.final_paid_at && inquiry?.status === 'approved')
}

/** 결제 수단 선택/등록 화면 진입 가능 여부 */
export function canAccessPaymentSetup(site, inquiry) {
  if (!isManagedSite(site)) return true
  return canStartManagedService(inquiry)
}

/** 고객 포털 「서비스 시작」 버튼 노출 */
export function managedNeedsGoLive(site, inquiry) {
  if (!isManagedSite(site)) return false
  if (!canStartManagedService(inquiry)) return false
  if (site.trial_started_at) return false
  return site.status === 'review' || site.status === 'published'
}

export function isInReviewPhase(site) {
  return site?.status === 'review'
}

export function managedBlockedMessage(inquiry) {
  if (!inquiry) return '본사 제작 문의가 연결되지 않았습니다.'
  if (!inquiry.final_paid_at) return '잔금 확인 후 서비스를 시작할 수 있습니다.'
  if (inquiry.status !== 'approved') return '승인 완료 후 서비스를 시작할 수 있습니다.'
  return null
}

/**
 * 대리 접수 취소 가능 — 선금 확인 전만 (고객·직원 공통)
 */
export function canCancelManagedIntake(inquiry) {
  if (!inquiry?.inquiry_id) return false
  if (inquiry.down_paid_at) return false
  return true
}

/**
 * 대리 접수 취소: 문의·연결 사이트·구독·1회성결제 soft delete (use_flag=0)
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} inquiryId
 */
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
    supabase.from('sites').select('site_id').eq('inquiry_id', inquiryId)
  )
  if (siteErr) throw new Error(siteErr.message)

  const siteIds = (linkedSites || []).map(s => s.site_id)
  const now = new Date().toISOString()

  for (const siteId of siteIds) {
    const { error: sErr } = await supabase.from('sites').update({
      status: 'cancelled',
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
