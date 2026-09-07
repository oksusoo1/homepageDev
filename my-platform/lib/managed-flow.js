/**
 * 본사 대리(managed) 제작·구독 플로우 (v1.3.2)
 *
 * 제작(inquiries) → 검수(review) → 잔금(approved) → 서비스 시작 → trial/active
 * 월 구독·next_billing_date는 서비스 시작 시점에만 생성
 */

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
