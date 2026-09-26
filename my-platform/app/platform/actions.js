'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/server/guard'
import { onlyActive, USE_FLAG_OFF, USE_FLAG_ON } from '@/lib/use-flag'
import { softDelete } from '@/lib/use-flag-write'
import { cancelManagedIntake } from '@/lib/managed-flow-write'
import { loadTicketMessages } from '@/lib/support-ticket'
import { addTicketMessage, markTicketMessagesRead } from '@/lib/support-ticket-write'
import { loadTicketQuotes } from '@/lib/payment/extra'
import { sendQuote, cancelQuote } from '@/lib/payment/extra-write'
import { runBillingBatch } from '@/lib/billing-batch'
import { calcTrialWindow } from '@/lib/trial'
import { assertSubdomainAvailable, makeSiteCode } from '@/lib/site-create'

function ok(data) {
  return { ok: true, data }
}

function fail(error) {
  return { ok: false, error: error || '처리에 실패했습니다.' }
}

async function withStaff() {
  const gate = await requireStaff()
  if (!gate.ok) return { gate, db: null }
  return { gate, db: createAdminClient() }
}

export async function getStaffMe() {
  const gate = await requireStaff()
  if (!gate.ok) return fail(gate.error)
  return ok({ staff: gate.staff })
}

export async function fetchPlatformData() {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)

  const [s, sub, t, otp, tmpl, inq, cust, bh, codes] = await Promise.all([
    onlyActive(db.from('sites').select('*, customers(name, email, phone)')).order('created_at', { ascending: false }),
    onlyActive(db.from('subscriptions').select('*, sites(site_name:name, subdomain, status), customers(name)')).order('created_at', { ascending: false }),
    onlyActive(db.from('support_tickets').select('*, sites(name), customers(name, email, phone)')).order('created_at', { ascending: false }),
    onlyActive(db.from('one_time_payments').select('*, customers(name), sites(name)')).order('created_at', { ascending: false }),
    onlyActive(db.from('templates').select('*')).order('sort_order'),
    onlyActive(db.from('inquiries').select('*, customers(name, email, phone)')).order('created_at', { ascending: false }),
    onlyActive(db.from('customers').select('*')).order('created_at', { ascending: false }),
    onlyActive(db.from('billing_history').select('*')).order('period', { ascending: false }),
    onlyActive(db.from('common_codes').select('*')).order('group_code').order('sort_order'),
  ])

  const firstErr = [s, sub, t, otp, tmpl, inq, cust, bh, codes].find(x => x.error)
  if (firstErr) return fail(firstErr.error.message)

  const ticketIds = (t.data || []).map(x => x.ticket_id)
  let ticketMsgs
  let ticketQuotes
  try {
    ;[ticketMsgs, ticketQuotes] = await Promise.all([
      loadTicketMessages(db, ticketIds),
      loadTicketQuotes(db, ticketIds),
    ])
  } catch (e) {
    return fail(e.message)
  }

  return ok({
    sites: s.data || [],
    subscriptions: sub.data || [],
    tickets: t.data || [],
    oneTimePays: otp.data || [],
    templates: tmpl.data || [],
    inquiries: inq.data || [],
    customers: cust.data || [],
    billings: bh.data || [],
    commonCodes: codes.data || [],
    ticketMsgs,
    ticketQuotes,
    staff: gate.staff,
  })
}

export async function createSite(form) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)

  try {
    const sub = await assertSubdomainAvailable(db, form.subdomain)
    if (!sub.ok) return fail(sub.error)
    const subdomain = sub.value
    if (!form.site_name?.trim()) return fail('사이트명을 입력하세요.')

    let customer
    if (form.customer_id) {
      const { data: byId, error: idErr } = await onlyActive(
        db.from('customers').select('*').eq('customer_id', form.customer_id)
      ).maybeSingle()
      if (idErr) return fail('회원 조회 오류: ' + idErr.message)
      if (!byId) return fail('가입 회원을 찾을 수 없습니다. 회원 메뉴를 확인하세요.')
      customer = byId
    } else if (form.customer_email?.trim()) {
      const email = form.customer_email.trim()
      const { data: existing } = await onlyActive(
        db.from('customers').select('*').eq('email', email)
      ).maybeSingle()
      if (existing) {
        customer = existing
      } else {
        const { data: newCust, error: cErr } = await db
          .from('customers')
          .insert([{
            email,
            name: form.customer_name || email,
            phone: form.customer_phone || null,
          }])
          .select()
          .single()
        if (cErr) return fail('고객 생성 오류: ' + cErr.message)
        customer = newCust
      }
    } else {
      return fail('회원을 선택하거나 이메일을 입력하세요.')
    }

    const site_code = makeSiteCode(subdomain)
    const { data: newSite, error: sErr } = await db
      .from('sites')
      .insert([{
        site_code,
        customer_id: customer.customer_id,
        template_id: form.template_id || null,
        name: form.site_name.trim(),
        subdomain,
        description: form.description || null,
        address: form.address || null,
        phone: form.phone || customer.phone || null,
        email: form.email || customer.email || null,
        build_type: 'self',
        status: 'building',
      }])
      .select('site_id, subdomain, name')
      .single()
    if (sErr) return fail('사이트 생성 오류: ' + sErr.message)

    return ok({
      site_id: newSite.site_id,
      name: newSite.name,
      customerName: customer.name || customer.email,
    })
  } catch (e) {
    return fail(e.message)
  }
}

export async function updateSiteStatus(siteId, flowStep) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)

  const now = new Date()
  const { data: siteInfo } = await onlyActive(
    db.from('sites').select('build_type, inquiry_id, trial_started_at').eq('site_id', siteId)
  ).maybeSingle()

  const next = flowStep
  if (siteInfo?.build_type === 'self' && next === 'preview') {
    return fail('셀프 사이트는 검토 단계가 없습니다.')
  }
  await db.from('sites')
    .update({ status: next, updated_at: now.toISOString() })
    .eq('site_id', siteId)
    .eq('use_flag', 1)

  if (next === 'trial' && siteInfo?.build_type === 'self' && !siteInfo.trial_started_at) {
    const { trialStartedAt, trialEndsAt, nextBillingDate } = calcTrialWindow(now)
    const { data: sub } = await onlyActive(
      db.from('subscriptions').select('subscription_id').eq('site_id', siteId)
    ).maybeSingle()
    if (sub) {
      await db.from('subscriptions').update({
        next_billing_date: nextBillingDate,
        updated_at: now.toISOString(),
      }).eq('subscription_id', sub.subscription_id)
    }
    await db.from('sites').update({
      trial_started_at: trialStartedAt,
      trial_ends_at: trialEndsAt,
    }).eq('site_id', siteId)
  }

  return ok(null)
}

export async function saveDevFee(inquiryId, amount) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)

  const num = parseInt(amount, 10)
  if (isNaN(num) || num <= 0) return fail('올바른 금액을 입력해 주세요.')

  const now = new Date().toISOString()
  const { data: inq } = await onlyActive(
    db.from('inquiries').select('*').eq('inquiry_id', inquiryId)
  ).maybeSingle()
  const { data: site } = await onlyActive(
    db.from('sites').select('*').eq('inquiry_id', inquiryId)
  ).maybeSingle()
  const { data: otps } = await onlyActive(
    db.from('one_time_payments').select('*').eq('type', 'dev_fee').eq('customer_id', inq?.customer_id || '')
  )
  const half = Math.floor(num / 2)

  await db.from('inquiries').update({ dev_fee_total: num, updated_at: now }).eq('inquiry_id', inquiryId)

  for (const stage of ['down', 'final']) {
    const paidAt = stage === 'down' ? inq?.down_paid_at : inq?.final_paid_at
    const existing = (otps || []).find(p =>
      p.type === 'dev_fee' && p.stage === stage && p.customer_id === inq?.customer_id
      && (site ? p.site_id === site.site_id : !p.site_id))
    const payload = {
      amount: half,
      note: `개발비 ${stage === 'down' ? '선금' : '잔금'} 50%`,
      status: paidAt ? 'paid' : (existing?.status === 'pending_confirm' ? 'pending_confirm' : 'unpaid'),
    }
    if (existing) {
      await db.from('one_time_payments').update(payload).eq('payment_id', existing.payment_id)
    } else if (inq?.customer_id) {
      await db.from('one_time_payments').insert({
        customer_id: inq.customer_id, site_id: site?.site_id || null,
        type: 'dev_fee', stage, use_flag: 1, ...payload,
      })
    }
  }

  if (site && (site.status === 'intake' || site.status === 'deposit')) {
    await db.from('sites').update({ status: 'deposit', updated_at: now }).eq('site_id', site.site_id)
  }

  return ok({ message: `✅ 견적 ${num.toLocaleString()}원 저장 · 선금/잔금 각 ${half.toLocaleString()}원 청구` })
}

export async function confirmDownPayment(inquiryId) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)

  const now = new Date().toISOString()
  const { data: inq } = await onlyActive(
    db.from('inquiries').select('*').eq('inquiry_id', inquiryId)
  ).maybeSingle()
  await db.from('inquiries')
    .update({ down_paid_at: now, updated_at: now })
    .eq('inquiry_id', inquiryId)
  const { data: site } = await onlyActive(
    db.from('sites').select('*').eq('inquiry_id', inquiryId)
  ).maybeSingle()
  if (inq?.customer_id) {
    let q = db.from('one_time_payments')
      .update({ status: 'paid', paid_at: now })
      .eq('customer_id', inq.customer_id)
      .eq('type', 'dev_fee')
      .eq('stage', 'down')
      .in('status', ['unpaid', 'pending_confirm'])
    await (site ? q.eq('site_id', site.site_id) : q)
  }
  if (site) {
    await db.from('sites')
      .update({ status: 'building', updated_at: now })
      .eq('site_id', site.site_id)
  }
  return ok(null)
}

export async function startDepositStep(inquiryId) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  const { data: site } = await onlyActive(
    db.from('sites').select('site_id').eq('inquiry_id', inquiryId)
  ).maybeSingle()
  if (site) {
    await db.from('sites')
      .update({ status: 'deposit', updated_at: new Date().toISOString() })
      .eq('site_id', site.site_id)
  }
  return ok(null)
}

export async function handleCancelManagedIntake(inquiryId) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  if (!inquiryId) return fail('문의가 없습니다.')
  try {
    await cancelManagedIntake(db, inquiryId)
    return ok(null)
  } catch (e) {
    return fail(e.message || String(e))
  }
}

export async function saveAdminNote(inquiryId, text) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  await db.from('inquiries')
    .update({ admin_note: text, updated_at: new Date().toISOString() })
    .eq('inquiry_id', inquiryId)
  return ok(null)
}

export async function confirmFinalPayment(inquiryId) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  const now = new Date().toISOString()
  const { data: inq } = await db
    .from('inquiries').select('customer_id').eq('inquiry_id', inquiryId).maybeSingle()
  await db.from('inquiries')
    .update({ final_paid_at: now, updated_at: now })
    .eq('inquiry_id', inquiryId)
  const { data: site } = await onlyActive(
    db.from('sites').select('*').eq('inquiry_id', inquiryId)
  ).maybeSingle()
  if (inq?.customer_id) {
    let q = db.from('one_time_payments')
      .update({ status: 'paid', paid_at: now })
      .eq('customer_id', inq.customer_id)
      .eq('type', 'dev_fee')
      .eq('stage', 'final')
      .in('status', ['unpaid', 'pending_confirm'])
    await (site ? q.eq('site_id', site.site_id) : q)
  }
  if (site) {
    await db.from('sites')
      .update({ status: 'pay_method', updated_at: now })
      .eq('site_id', site.site_id)
  }
  return ok(null)
}

export async function deleteSite(siteId) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  try {
    await softDelete(db, 'sites', 'site_id', siteId)
    return ok(null)
  } catch (e) {
    return fail(e.message)
  }
}

export async function saveSiteFields(siteId, patch) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  const { error } = await db
    .from('sites')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('site_id', siteId)
  if (error) return fail(error.message)
  return ok(null)
}

export async function saveCustomerFields(customerId, patch) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  const { error } = await db
    .from('customers')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('customer_id', customerId)
  if (error) return fail(error.message)
  return ok(null)
}

export async function deleteCustomer(customerId) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  try {
    await softDelete(db, 'customers', 'customer_id', customerId)
    return ok(null)
  } catch (e) {
    return fail(e.message)
  }
}

export async function sendTicketQuote(ticket, { amount, note }) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  try {
    await sendQuote(db, { ticket, amount, note })
    await addTicketMessage(db, {
      ticketId: ticket.ticket_id, authorType: 'staff', author: gate.staff?.name || '본사',
      content: [
        '유료 작업 견적을 보내드립니다.',
        `금액: ${parseInt(amount, 10).toLocaleString()}원`,
        note ? `작업: ${note}` : null,
        '결제 후 작업을 시작합니다.',
      ].filter(Boolean).join('\n'),
    })
    if (ticket.status === 'open') {
      await db.from('support_tickets')
        .update({ status: 'in_progress', handled_by: gate.staff?.staff_id || null, updated_at: new Date().toISOString() })
        .eq('ticket_id', ticket.ticket_id)
    }
    return ok(null)
  } catch (e) {
    return fail(e.message)
  }
}

export async function cancelTicketQuote(paymentId) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  try {
    await cancelQuote(db, paymentId)
    return ok(null)
  } catch (e) {
    return fail(e.message)
  }
}

export async function readTicketMsgs(ticketId) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  const changed = await markTicketMessagesRead(db, [ticketId], 'staff')
  return ok({ changed })
}

export async function addTicketMsg(ticketId, { content, isInternal }) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  try {
    await addTicketMessage(db, {
      ticketId, authorType: 'staff', author: gate.staff?.name || '본사', content, isInternal,
    })
    return ok(null)
  } catch (e) {
    return fail(e.message)
  }
}

export async function updateTicket(ticketId, patch) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  const { error } = await db.from('support_tickets')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('ticket_id', ticketId)
  if (error) return fail(error.message)
  return ok(null)
}

export async function markBillingPaid(sub, amount, period, paymentMethod) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)

  const subId = sub.subscription_id
  const siteId = sub.site_id
  try {
    const { data: existing } = await db
      .from('billing_history')
      .select('billing_id, status')
      .eq('subscription_id', subId)
      .eq('period', period)
      .maybeSingle()

    if (existing?.status === 'paid') {
      return ok({ already: true, message: '이미 납부 확인된 내역입니다.' })
    }

    const now = new Date().toISOString()
    if (existing) {
      await db.from('billing_history')
        .update({ status: 'paid', paid_at: now })
        .eq('billing_id', existing.billing_id)
    } else {
      await db.from('billing_history').insert([{
        subscription_id: subId, period, amount,
        status: 'paid', payment_method: paymentMethod || 'manual', paid_at: now,
      }])
    }

    if (!paymentMethod || paymentMethod === 'manual') {
      const next = new Date()
      next.setMonth(next.getMonth() + 1)
      await db.from('subscriptions')
        .update({ next_billing_date: next.toISOString().split('T')[0] })
        .eq('subscription_id', subId)
    }

    if (siteId) {
      await db.from('sites')
        .update({ status: 'subscribed', updated_at: now })
        .eq('site_id', siteId)
    }

    return ok({ message: `✅ ${period} 납부 확인 완료` })
  } catch (e) {
    return fail(e.message)
  }
}

export async function markOneTimePaid(paymentId) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)

  const { data: pay } = await onlyActive(
    db.from('one_time_payments').select('*').eq('payment_id', paymentId)
  ).maybeSingle()
  const now = new Date().toISOString()

  const { error } = await db.from('one_time_payments')
    .update({ status: 'paid', paid_at: now })
    .eq('payment_id', paymentId)
  if (error) return fail(error.message)

  const { data: sites } = await onlyActive(db.from('sites').select('*'))
  const { data: inquiries } = await onlyActive(db.from('inquiries').select('*'))

  if (pay?.type === 'dev_fee' && pay.stage === 'down' && pay.customer_id) {
    const site = pay.site_id ? (sites || []).find(s => s.site_id === pay.site_id) : null
    const inquiryId = site?.inquiry_id
      || (inquiries || []).find(i => i.customer_id === pay.customer_id && !i.down_paid_at)?.inquiry_id
      || null
    if (inquiryId) {
      await db.from('inquiries').update({ down_paid_at: now, updated_at: now }).eq('inquiry_id', inquiryId)
    }
    const target = site || (sites || []).find(s => s.inquiry_id === inquiryId) || null
    if (target && ['intake', 'deposit'].includes(target.status)) {
      await db.from('sites').update({ status: 'building', updated_at: now }).eq('site_id', target.site_id)
    }
    return ok(null)
  }

  if (pay?.type === 'dev_fee' && pay.customer_id) {
    let site = pay.site_id ? (sites || []).find(s => s.site_id === pay.site_id) : null
    let inquiryId = site?.inquiry_id || null
    if (!inquiryId) {
      const candidate = (inquiries || []).find(i =>
        i.customer_id === pay.customer_id && !i.final_paid_at
      )
      inquiryId = candidate?.inquiry_id || null
      if (!site && inquiryId) site = (sites || []).find(s => s.inquiry_id === inquiryId) || null
    }
    if (inquiryId) {
      const { error: inqErr } = await db.from('inquiries')
        .update({ final_paid_at: now, updated_at: now })
        .eq('inquiry_id', inquiryId)
      if (inqErr) return fail(inqErr.message)
    }
    if (site) {
      await db.from('sites')
        .update({ status: 'pay_method', updated_at: now })
        .eq('site_id', site.site_id)
    } else if (!inquiryId) {
      return ok({ warn: '결제 행은 납부완료 처리됐지만, 연결 사이트/문의를 찾지 못했습니다. 사이트 상세에서 「잔금 확인」을 눌러 주세요.' })
    }
  }

  return ok(null)
}

/** 개발>테스트 */
export async function updateDevSite(siteId, patch) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  const { error } = await db.from('sites').update({ ...patch, updated_at: new Date().toISOString() }).eq('site_id', siteId)
  if (error) return fail(error.message)
  return ok(null)
}

export async function updateDevInquiry(inquiryId, patch) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  if (!inquiryId) return fail('연결된 inquiries 행이 없습니다.')
  const { error } = await db.from('inquiries').update({ ...patch, updated_at: new Date().toISOString() }).eq('inquiry_id', inquiryId)
  if (error) return fail(error.message)
  return ok(null)
}

export async function deleteDevBillingThenSub(subscriptionId) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  if (!subscriptionId) return ok(null)
  await db.from('billing_history').delete().eq('subscription_id', subscriptionId)
  const { error } = await db.from('subscriptions').delete().eq('subscription_id', subscriptionId)
  if (error) return fail(error.message)
  return ok(null)
}

export async function softDeleteDevFeeOtps(paymentIds) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  for (const paymentId of paymentIds || []) {
    const { error } = await db.from('one_time_payments')
      .update({ use_flag: USE_FLAG_OFF })
      .eq('payment_id', paymentId)
    if (error) return fail(error.message)
  }
  return ok(null)
}

export async function updateDevOtp(paymentId, patch) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  const { error } = await db.from('one_time_payments').update(patch).eq('payment_id', paymentId)
  if (error) return fail(error.message)
  return ok(null)
}

export async function insertDevOtp(row) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  const { error } = await db.from('one_time_payments').insert(row)
  if (error) return fail(error.message)
  return ok(null)
}

export async function rewindDevSite({ siteId, step, inquiryId, subscriptionId, otps, customerId, customerName, devFeeTotal }) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  if (!siteId) return fail('사이트를 선택하세요.')

  const now = new Date().toISOString()

  async function updateSite(patch) {
    const { error } = await db.from('sites').update({ ...patch, updated_at: now }).eq('site_id', siteId)
    if (error) throw new Error(error.message)
  }
  async function updateInquiry(patch) {
    if (!inquiryId) return
    const { error } = await db.from('inquiries').update({ ...patch, updated_at: now }).eq('inquiry_id', inquiryId)
    if (error) throw new Error(error.message)
  }
  async function deleteBillingThenSub() {
    if (!subscriptionId) return
    await db.from('billing_history').delete().eq('subscription_id', subscriptionId)
    const { error } = await db.from('subscriptions').delete().eq('subscription_id', subscriptionId)
    if (error) throw new Error(error.message)
  }
  async function deleteDevFeeOtps() {
    for (const p of (otps || []).filter(o => o.type === 'dev_fee')) {
      const { error } = await db.from('one_time_payments')
        .update({ use_flag: USE_FLAG_OFF })
        .eq('payment_id', p.payment_id)
      if (error) throw new Error(error.message)
    }
  }

  const { data: rewindSite } = await onlyActive(
    db.from('sites').select('build_type').eq('site_id', siteId)
  ).maybeSingle()

  try {
    if (step === 'preview') {
      const previewStatus = rewindSite?.build_type === 'self' ? 'building' : 'preview'
      await updateSite({ status: previewStatus, trial_started_at: null, trial_ends_at: null })
      if (inquiryId) await updateInquiry({ final_paid_at: null })
      await deleteDevFeeOtps()
      await deleteBillingThenSub()
    }

    if (step === 'deposit_pending') {
      await updateSite({ status: 'balance', trial_started_at: null, trial_ends_at: null })
      if (inquiryId) await updateInquiry({ final_paid_at: null })
      const existing = (otps || []).find(o => o.type === 'dev_fee')
      if (existing) {
        const { error } = await db.from('one_time_payments').update({
          status: 'pending_confirm',
          paid_at: null,
          note: existing.note || `잔금 입금 확인 요청 · 입금자: ${customerName || ''}`,
        }).eq('payment_id', existing.payment_id)
        if (error) throw new Error(error.message)
      } else if (inquiryId) {
        const { error } = await db.from('one_time_payments').insert({
          customer_id: customerId,
          site_id: siteId,
          type: 'dev_fee',
          amount: Math.floor((devFeeTotal || 200000) / 2),
          status: 'pending_confirm',
          note: `잔금 입금 확인 요청 · 입금자: ${customerName || ''}`,
        })
        if (error) throw new Error(error.message)
      }
      await deleteBillingThenSub()
    }

    if (step === 'ready_golive') {
      await updateSite({ status: 'pay_method', trial_started_at: null, trial_ends_at: null })
      if (inquiryId) await updateInquiry({ final_paid_at: now })
      const existing = (otps || []).find(o => o.type === 'dev_fee')
      if (existing) {
        const { error } = await db.from('one_time_payments').update({ status: 'paid', paid_at: now }).eq('payment_id', existing.payment_id)
        if (error) throw new Error(error.message)
      } else if (inquiryId) {
        const { error } = await db.from('one_time_payments').insert({
          customer_id: customerId,
          site_id: siteId,
          type: 'dev_fee',
          amount: Math.floor((devFeeTotal || 200000) / 2),
          status: 'paid',
          paid_at: now,
          note: '잔금 확인 (테스트)',
        })
        if (error) throw new Error(error.message)
      }
      await deleteBillingThenSub()
    }

    if (step === 'building') {
      await updateSite({ status: 'building', trial_started_at: null, trial_ends_at: null })
      if (inquiryId) await updateInquiry({ final_paid_at: null })
      await deleteDevFeeOtps()
      await deleteBillingThenSub()
    }
    return ok(null)
  } catch (e) {
    return fail(e.message)
  }
}

export async function runBillingBatchAction(asOfDate) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  try {
    const result = await runBillingBatch({ asOfDate, client: db })
    return ok(result)
  } catch (e) {
    return fail(e.message || '배치 실패')
  }
}

export async function fetchCommonCodes() {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  const { data, error } = await db
    .from('common_codes')
    .select('*')
    .order('group_code')
    .order('sort_order')
  if (error) return fail(error.message)
  return ok(data || [])
}

export async function fetchCommonCodesByGroup(groupCode) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  const { data, error } = await db
    .from('common_codes')
    .select('*')
    .eq('group_code', groupCode)
    .order('sort_order')
  if (error) return fail(error.message)
  return ok(data || [])
}

export async function updateCommonCode(id, patch) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  const { error } = await db.from('common_codes').update({
    ...patch,
    updated_at: new Date().toISOString(),
  }).eq('common_code_id', id)
  if (error) return fail(error.message)
  return ok(null)
}

export async function insertCommonCode(row) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  const { error } = await db.from('common_codes').insert(row)
  if (error) return fail(error.message)
  return ok(null)
}

export async function softDeleteCommonCode(id) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  const { error } = await db.from('common_codes').update({
    use_flag: USE_FLAG_OFF,
    updated_at: new Date().toISOString(),
  }).eq('common_code_id', id)
  if (error) return fail(error.message)
  return ok(null)
}

export async function saveAllCommonCodes(rows) {
  const { gate, db } = await withStaff()
  if (!gate.ok) return fail(gate.error)
  const now = new Date().toISOString()
  for (const row of rows || []) {
    const label = (row.label || '').trim()
    if (!label) return fail(`코드 "${row.code}" 표시명이 비어 있습니다`)
    const { error } = await db.from('common_codes').update({
      label,
      description: (row.description || '').trim() || null,
      sort_order: Number(row.sort_order) || 10,
      use_flag: row.use_flag ? USE_FLAG_ON : USE_FLAG_OFF,
      updated_at: now,
    }).eq('common_code_id', row.common_code_id)
    if (error) return fail(error.message)
  }
  return ok(null)
}
