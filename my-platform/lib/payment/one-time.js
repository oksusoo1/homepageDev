/**
 * 1회성 결제 — 개발비 선금(down) · 잔금(final)
 * 구독(billing.js)과 분리. 결제 행은 one_time_payments(type=dev_fee, stage=down|final)
 *
 * 단계별 진입 조건 (sites.status = FLOW_STEP)
 *   down  : deposit           — 견적 나온 뒤, 선금 확인 전
 *   final : preview | balance — 제작·검수 후, 잔금 확인 전
 */

export const STAGE_META = {
  down: { key: 'down', label: '선금', order: '선금 50%', nextHint: '선금이 확인되면 제작이 시작됩니다.' },
  final: { key: 'final', label: '잔금', order: '잔금 50%', nextHint: '잔금이 확인되면 결제 수단 등록 후 서비스가 시작됩니다.' },
}

export function stageMeta(stage) {
  return STAGE_META[stage] || STAGE_META.final
}

/** 개발비 선금/잔금 breakdown */
export function getDevFeeBreakdown(inquiry, { finalPending = false, downPending = false } = {}) {
  const total = inquiry?.dev_fee_total || 0
  if (!total) return null

  const half = Math.floor(total / 2)
  const downPaid = !!inquiry?.down_paid_at
  const finalPaid = !!inquiry?.final_paid_at

  return {
    total,
    downPayment: half,
    finalPayment: half,
    downPaid,
    downPending: !downPaid && !!downPending,
    finalPaid,
    finalPending: !finalPaid && !!finalPending,
    remaining: (downPaid ? 0 : half) + (finalPaid ? 0 : half),
  }
}

/** 단계 금액 (개발비의 50%) */
export function getStageAmount(inquiry) {
  if (!inquiry?.dev_fee_total) return null
  return Math.floor(inquiry.dev_fee_total / 2)
}

/** @deprecated getStageAmount 사용 */
export function getFinalPaymentAmount(inquiry) {
  return getStageAmount(inquiry)
}

/** 사이트 단계로 결제 가능한 stage 판단 */
export function payableStage(site, inquiry) {
  if (!site || !inquiry?.dev_fee_total) return null
  if (!inquiry.down_paid_at && site.status === 'deposit') return 'down'
  if (!inquiry.final_paid_at && ['preview', 'balance'].includes(site.status)) return 'final'
  return null
}

/**
 * 해당 사이트·단계의 입금확인 대기 행
 * ※ 고객이 사이트를 여러 개 가질 수 있으므로 **반드시 site 기준**으로 찾는다
 */
export function pendingOtpOf(otps, stage, siteId = null) {
  return (otps || []).find(p =>
    p.type === 'dev_fee' && p.stage === stage && p.status === 'pending_confirm'
    && (siteId ? p.site_id === siteId : true)
  ) || null
}

/** 고객의 개발비 결제 행 (선금·잔금) */
export async function loadDevFeePayments(supabase, customerId) {
  const { data } = await supabase
    .from('one_time_payments')
    .select('payment_id, site_id, stage, status, amount, note')
    .eq('customer_id', customerId)
    .eq('type', 'dev_fee')
    .eq('use_flag', 1)
  return data || []
}

/** @deprecated loadDevFeePayments 사용 — 잔금 입금확인 대기만 */
export async function loadPendingFinalPayments(supabase, customerId) {
  const rows = await loadDevFeePayments(supabase, customerId)
  return rows.filter(p => p.stage === 'final' && p.status === 'pending_confirm')
}

/**
 * 결제 화면 진입 검증
 * @returns {{ ok: boolean, error?: string, inquiry?: object, site?: object, stage?: string }}
 */
export async function loadInquiryForPayment(supabase, inquiryId, customerId, stage = 'final') {
  const { data: inquiry, error } = await supabase
    .from('inquiries')
    .select('*')
    .eq('inquiry_id', inquiryId)
    .eq('customer_id', customerId)
    .eq('use_flag', 1)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!inquiry) return { ok: false, error: '제작 의뢰를 찾을 수 없습니다.' }
  if (!inquiry.dev_fee_total) return { ok: false, error: '아직 견적이 나오지 않았습니다. 본사 안내를 기다려 주세요.' }

  const { data: site } = await supabase
    .from('sites')
    .select('site_id, status')
    .eq('inquiry_id', inquiryId)
    .eq('use_flag', 1)
    .maybeSingle()

  const otps = await loadDevFeePayments(supabase, customerId)
  if (pendingOtpOf(otps, stage, site?.site_id)) {
    return { ok: false, error: `${stageMeta(stage).label} 입금 확인을 이미 요청하셨습니다. 본사 확인을 기다려 주세요.` }
  }

  const payable = payableStage(site, inquiry)
  if (payable !== stage) {
    if (stage === 'down' && inquiry.down_paid_at) return { ok: false, error: '선금은 이미 확인되었습니다.' }
    if (stage === 'final' && inquiry.final_paid_at) return { ok: false, error: '잔금은 이미 확인되었습니다.' }
    return { ok: false, error: `지금은 ${stageMeta(stage).label}을 납부할 수 없습니다.` }
  }

  return { ok: true, inquiry, site, stage }
}

/** 잔금 입금확인대기 여부 (본사 화면 표시용) */
export function isFinalPaymentPending(pendingOtps, linkedSite) {
  if (!pendingOtps?.length) return false
  const finals = pendingOtps.filter(p => p.stage !== 'down')
  if (!finals.length) return false
  if (linkedSite?.site_id) {
    if (finals.some(p => p.site_id === linkedSite.site_id)) return true
  }
  return finals.some(p => !p.site_id) || !linkedSite
}
