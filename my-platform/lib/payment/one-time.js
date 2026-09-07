/**
 * 1회성 결제 (개발비 선금/잔금, 도메인 대행 등)
 * 구독(billing.js)과 분리 — 완료 후 inquiry / one_time_payments 갱신
 */

/** 고객용 문의 진행 단계 라벨 */
export const INQUIRY_CUSTOMER_STEPS = [
  { key: 'received', label: '접수완료', desc: '문의가 접수되었습니다.' },
  { key: 'reviewing', label: '검토/견적', desc: '담당자가 견적을 검토 중입니다.' },
  { key: 'building', label: '제작중', desc: '사이트를 제작하고 있습니다.' },
  { key: 'review', label: '미리보기·잔금', desc: '미리보기를 확인하신 후 잔금을 납부해 주세요.' },
  { key: 'approved', label: '서비스 시작 준비', desc: '월 구독 결제 수단을 등록하고 서비스를 시작해 주세요.' },
]

export function getInquiryStepIndex(status) {
  const idx = INQUIRY_CUSTOMER_STEPS.findIndex(s => s.key === status)
  return idx === -1 ? 0 : idx
}

/**
 * 잔금 입금확인대기(one_time_payments.status=pending_confirm) 여부
 * @param {Array} pendingOtps - type=dev_fee & status=pending_confirm 행들
 * @param {{ site_id?: string }|null} linkedSite
 */
export function isFinalPaymentPending(pendingOtps, linkedSite) {
  if (!pendingOtps?.length) return false
  if (linkedSite?.site_id) {
    const bySite = pendingOtps.some(p => p.site_id === linkedSite.site_id)
    if (bySite) return true
  }
  // site_id 없는 신청도 동일 고객 잔금으로 취급
  return pendingOtps.some(p => !p.site_id) || (!linkedSite && pendingOtps.length > 0)
}

/** 개발비 선금/잔금 breakdown */
export function getDevFeeBreakdown(inquiry, { finalPending = false } = {}) {
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
    finalPaid,
    finalPending: !finalPaid && !!finalPending,
    remaining: finalPaid ? 0 : half,
  }
}

/** 잔금(개발비 50%) 금액 */
export function getFinalPaymentAmount(inquiry) {
  if (!inquiry?.dev_fee_total) return null
  return Math.floor(inquiry.dev_fee_total / 2)
}

/** 잔금 결제 화면 진입 가능 (입금확인 중이면 false) */
export function canPayFinalBalance(inquiry, { finalPending = false } = {}) {
  if (finalPending) return false
  return inquiry?.status === 'review' && !inquiry?.final_paid_at && !!inquiry?.dev_fee_total
}

/** 고객의 잔금 입금확인대기 행 조회 */
export async function loadPendingFinalPayments(supabase, customerId) {
  const { data, error } = await supabase
    .from('one_time_payments')
    .select('payment_id, site_id, status, amount, note')
    .eq('customer_id', customerId)
    .eq('type', 'dev_fee')
    .eq('status', 'pending_confirm')
    .eq('use_flag', 1)
  if (error) return []
  return data || []
}

/**
 * @returns {{ ok: boolean, error?: string, inquiry?: object }}
 */
export async function loadInquiryForPayment(supabase, inquiryId, customerId) {
  const { data: inquiry, error } = await supabase
    .from('inquiries')
    .select('*')
    .eq('inquiry_id', inquiryId)
    .eq('customer_id', customerId)
    .eq('use_flag', 1)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!inquiry) return { ok: false, error: '문의를 찾을 수 없습니다.' }

  const pendingOtps = await loadPendingFinalPayments(supabase, customerId)
  const { data: linkedSite } = await supabase
    .from('sites')
    .select('site_id')
    .eq('inquiry_id', inquiryId)
    .eq('use_flag', 1)
    .maybeSingle()
  const finalPending = isFinalPaymentPending(pendingOtps, linkedSite)

  if (finalPending) {
    return { ok: false, error: '이미 잔금 입금 신청이 접수되었습니다. 본사 확인을 기다려 주세요.' }
  }
  if (!canPayFinalBalance(inquiry)) {
    return { ok: false, error: '지금은 잔금을 납부할 수 없습니다.' }
  }
  return { ok: true, inquiry }
}

/** 계좌이체 — 입금 신청 (본사 확인 대기) */
export async function submitFinalPaymentBankTransfer(supabase, { inquiry, customerId, siteId, depositorName }) {
  const amount = getFinalPaymentAmount(inquiry)
  const name = (depositorName || '').trim()
  if (!name) return { error: '입금자명을 입력해 주세요.' }

  const note = `잔금 입금 신청 · 입금자: ${name}`

  const { data: existing } = await supabase
    .from('one_time_payments')
    .select('payment_id')
    .eq('customer_id', customerId)
    .eq('type', 'dev_fee')
    .eq('use_flag', 1)
    .in('status', ['unpaid', 'pending_confirm'])
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('one_time_payments')
      .update({ note, amount, status: 'pending_confirm' })
      .eq('payment_id', existing.payment_id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('one_time_payments').insert({
      customer_id: customerId,
      site_id: siteId || null,
      type: 'dev_fee',
      amount,
      status: 'pending_confirm',
      note,
      use_flag: 1,
    })
    if (error) return { error: error.message }
  }

  return { error: null, pending: true }
}

/**
 * 카드 결제 목업 — 잔금 즉시 승인 (PG 연동 전)
 * inquiries + one_time_payments 를 함께 갱신 (계좌이체 확인과 동일 결과)
 */
export async function completeFinalPaymentCardMock(supabase, { inquiryId, customerId, siteId, amount }) {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('inquiries')
    .update({ final_paid_at: now, status: 'approved', updated_at: now })
    .eq('inquiry_id', inquiryId)

  if (error) return { error: error.message }

  if (customerId) {
    const { data: existing } = await supabase
      .from('one_time_payments')
      .select('payment_id')
      .eq('customer_id', customerId)
      .eq('type', 'dev_fee')
      .eq('use_flag', 1)
      .in('status', ['unpaid', 'pending_confirm'])
      .maybeSingle()

    if (existing) {
      const patch = { status: 'paid', paid_at: now, note: '잔금 카드결제(목업)' }
      if (amount != null) patch.amount = amount
      const { error: otpErr } = await supabase
        .from('one_time_payments')
        .update(patch)
        .eq('payment_id', existing.payment_id)
      if (otpErr) return { error: otpErr.message }
    } else {
      const { error: otpErr } = await supabase.from('one_time_payments').insert({
        customer_id: customerId,
        site_id: siteId || null,
        type: 'dev_fee',
        amount: amount || 0,
        status: 'paid',
        paid_at: now,
        note: '잔금 카드결제(목업)',
        use_flag: 1,
      })
      if (otpErr) return { error: otpErr.message }
    }
  }

  return { error: null }
}
