/**
 * 1회성 결제 (개발비 선금/잔금, 도메인 대행 등)
 * 구독(billing.js)과 분리 — 완료 후 inquiries(납부일) / one_time_payments / sites.status
 */

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

/** 잔금 결제 화면 진입 — sites.status preview|balance, 잔금 미납 */
export function canPayFinalBalance(inquiry, { finalPending = false, site = null } = {}) {
  if (finalPending) return false
  if (!inquiry?.dev_fee_total || inquiry?.final_paid_at) return false
  return site?.status === 'preview' || site?.status === 'balance'
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
    .select('site_id, status')
    .eq('inquiry_id', inquiryId)
    .eq('use_flag', 1)
    .maybeSingle()
  const finalPending = isFinalPaymentPending(pendingOtps, linkedSite)

  if (finalPending) {
    return { ok: false, error: '이미 잔금 입금 신청이 접수되었습니다. 본사 확인을 기다려 주세요.' }
  }
  if (!canPayFinalBalance(inquiry, { site: linkedSite })) {
    return { ok: false, error: '지금은 잔금을 납부할 수 없습니다.' }
  }
  return { ok: true, inquiry, site: linkedSite }
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

  // 진도 → balance
  if (siteId) {
    await supabase.from('sites')
      .update({ status: 'balance', updated_at: new Date().toISOString() })
      .eq('site_id', siteId)
      .eq('use_flag', 1)
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
    .update({ final_paid_at: now, updated_at: now })
    .eq('inquiry_id', inquiryId)

  if (error) return { error: error.message }

  if (siteId) {
    await supabase.from('sites')
      .update({ status: 'pay_method', updated_at: now })
      .eq('site_id', siteId)
      .eq('use_flag', 1)
  } else {
    const { data: site } = await supabase
      .from('sites')
      .select('site_id')
      .eq('inquiry_id', inquiryId)
      .eq('use_flag', 1)
      .maybeSingle()
    if (site?.site_id) {
      await supabase.from('sites')
        .update({ status: 'pay_method', updated_at: now })
        .eq('site_id', site.site_id)
    }
  }

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
