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

/** 해당 단계의 결제 행 (없으면 만들고 있으면 갱신) */
async function upsertStagePayment(supabase, { customerId, siteId, stage, amount, status, note, paidAt = null }) {
  // 사이트별로 1행 — 고객이 사이트를 여러 개 가질 수 있다
  let q = supabase
    .from('one_time_payments')
    .select('payment_id')
    .eq('customer_id', customerId)
    .eq('type', 'dev_fee')
    .eq('stage', stage)
    .eq('use_flag', 1)
  q = siteId ? q.eq('site_id', siteId) : q.is('site_id', null)
  const { data: rows } = await q.limit(1)
  const existing = rows?.[0] || null

  const payload = { amount, status, note, paid_at: paidAt }
  if (existing) {
    const { error } = await supabase.from('one_time_payments').update(payload).eq('payment_id', existing.payment_id)
    if (error) throw new Error(error.message)
    return existing.payment_id
  }
  const { error } = await supabase.from('one_time_payments').insert({
    customer_id: customerId, site_id: siteId || null, type: 'dev_fee', stage, use_flag: 1, ...payload,
  })
  if (error) throw new Error(error.message)
  return null
}

/** 계좌이체 — 고객이 입금 후 확인 요청 (본사가 통장 확인) */
export async function submitStageBankTransfer(supabase, { inquiry, customerId, siteId, depositorName, stage }) {
  const name = (depositorName || '').trim()
  if (!name) return { error: '입금자명을 입력해 주세요.' }

  try {
    await upsertStagePayment(supabase, {
      customerId, siteId, stage,
      amount: getStageAmount(inquiry),
      status: 'pending_confirm',
      note: `개발비 ${stageMeta(stage).label} 입금 확인 요청 · 입금자: ${name}`,
    })
  } catch (e) {
    return { error: e.message }
  }

  // 잔금 신청은 진도를 balance 로 (본사 확인 대기 표시). 선금은 deposit 유지
  if (stage === 'final' && siteId) {
    await supabase.from('sites')
      .update({ status: 'balance', updated_at: new Date().toISOString() })
      .eq('site_id', siteId)
      .eq('use_flag', 1)
  }

  return { error: null, pending: true }
}

/**
 * 카드 결제 목업 — 즉시 승인 (PG 연동 전)
 * MOCK: 실결제 연동 시 PG 승인 확인 후에만 paid 처리
 * 선금: down_paid_at + sites.status=building · 잔금: final_paid_at + sites.status=pay_method
 */
export async function completeStageCardMock(supabase, { inquiryId, customerId, siteId, inquiry, stage }) {
  const now = new Date().toISOString()
  const amount = getStageAmount(inquiry)

  const patch = stage === 'down'
    ? { down_paid_at: now, updated_at: now }
    : { final_paid_at: now, updated_at: now }

  const { error } = await supabase.from('inquiries').update(patch).eq('inquiry_id', inquiryId)
  if (error) return { error: error.message }

  try {
    await upsertStagePayment(supabase, {
      customerId, siteId, stage, amount,
      status: 'paid',
      note: `개발비 ${stageMeta(stage).label} 카드결제(목업)`,
      paidAt: now,
    })
  } catch (e) {
    return { error: e.message }
  }

  const nextStatus = stage === 'down' ? 'building' : 'pay_method'
  let targetSiteId = siteId
  if (!targetSiteId) {
    const { data: site } = await supabase
      .from('sites').select('site_id').eq('inquiry_id', inquiryId).eq('use_flag', 1).maybeSingle()
    targetSiteId = site?.site_id || null
  }
  if (targetSiteId) {
    await supabase.from('sites').update({ status: nextStatus, updated_at: now }).eq('site_id', targetSiteId)
  }

  return { error: null }
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
