'use server'

import { getServerUser, requireCustomer, requireOwnedInquiry, requireOwnedSiteByCode } from '@/lib/server/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { onlyActive } from '@/lib/use-flag'
import { canCancelManagedIntake } from '@/lib/managed-flow'
import { cancelManagedIntake } from '@/lib/managed-flow-write'
import { loadInquiryForPayment, stageMeta } from '@/lib/payment/one-time'
import { submitStageBankTransfer, completeStageCardMock } from '@/lib/payment/one-time-write'
import { assertSubdomainAvailable, resolveTemplateId, makeSiteCode } from '@/lib/site-create'
import { pickSiteOwnerPatch } from '@/lib/site-edit'
import { isPaidSubscription } from '@/lib/subscription-life'

function ok(data) {
  return { ok: true, data }
}

function fail(error) {
  return { ok: false, error: error || '처리에 실패했습니다.' }
}

function normalizeStage(stage) {
  return stage === 'down' ? 'down' : 'final'
}

/** 대리 접수 취소 — 선금 전만 */
export async function cancelManagedIntakeAction(inquiryId) {
  const gate = await requireOwnedInquiry(inquiryId)
  if (!gate.ok) return fail(gate.error)

  const { db, inquiry, site } = gate
  if (!canCancelManagedIntake(inquiry, site)) {
    return fail('선금 확인 후에는 접수 취소할 수 없습니다.')
  }

  try {
    await cancelManagedIntake(db, inquiry.inquiry_id)
  } catch (e) {
    return fail(e.message)
  }
  return ok(null)
}

/** 선금·잔금 계좌이체 확인 요청 unpaid → pending_confirm */
export async function requestStageBankConfirmAction(inquiryId, { depositorName, stage } = {}) {
  const gate = await requireOwnedInquiry(inquiryId)
  if (!gate.ok) return fail(gate.error)

  const st = normalizeStage(stage)
  const check = await loadInquiryForPayment(gate.db, inquiryId, gate.customer.customer_id, st)
  if (!check.ok) return fail(check.error)

  const result = await submitStageBankTransfer(gate.db, {
    inquiry: check.inquiry,
    customerId: gate.customer.customer_id,
    siteId: check.site?.site_id || gate.site?.site_id || null,
    depositorName,
    stage: st,
  })
  if (result.error) return fail(result.error)
  return ok({ pending: true, stage: st, label: stageMeta(st).label })
}

/**
 * 선금·잔금 카드 목업.
 * MOCK: 실결제 연동 시 PG 승인 확인 후에만 paid 처리
 */
export async function payStageCardMockAction(inquiryId, { stage } = {}) {
  const gate = await requireOwnedInquiry(inquiryId)
  if (!gate.ok) return fail(gate.error)

  const st = normalizeStage(stage)
  const check = await loadInquiryForPayment(gate.db, inquiryId, gate.customer.customer_id, st)
  if (!check.ok) return fail(check.error)

  // MOCK: 실결제 연동 시 PG 승인 확인 후에만 paid 처리
  const result = await completeStageCardMock(gate.db, {
    inquiryId: check.inquiry.inquiry_id,
    customerId: gate.customer.customer_id,
    siteId: check.site?.site_id || gate.site?.site_id || null,
    inquiry: check.inquiry,
    stage: st,
  })
  if (result.error) return fail(result.error)
  return ok({ paid: true, stage: st, label: stageMeta(st).label })
}

function clip(s, max) {
  const t = String(s ?? '').trim()
  return t.length > max ? t.slice(0, max) : t
}

/** 셀프 사이트 생성 — status/build_type 서버 고정 */
export async function createSelfSiteAction(form = {}) {
  const gate = await requireCustomer()
  if (!gate.ok) return fail(gate.error)

  const namePick = pickSiteOwnerPatch({ name: form.name })
  if (!namePick.ok) return fail(namePick.error)

  const sub = await assertSubdomainAvailable(gate.db, form.subdomain)
  if (!sub.ok) return fail(sub.error)

  const tmpl = await resolveTemplateId(gate.db, form.templateId)
  if (!tmpl.ok) return fail(tmpl.error)

  const display = pickSiteOwnerPatch({
    name: form.name,
    description: form.description,
    address: form.address,
    phone: form.phone,
    email: form.email,
  })
  const extra = display.ok ? display.patch : { name: namePick.patch.name }

  const { data, error } = await gate.db
    .from('sites')
    .insert([{
      site_code: makeSiteCode(sub.value),
      customer_id: gate.customer.customer_id,
      template_id: tmpl.templateId,
      name: extra.name,
      subdomain: sub.value,
      description: extra.description ?? null,
      address: extra.address ?? null,
      phone: extra.phone ?? null,
      email: extra.email ?? null,
      build_type: 'self',
      status: 'building',
    }])
    .select('site_id, subdomain, name')
    .single()
  if (error) return fail(error.message)
  return ok(data)
}

/** 대리 제작 의뢰 + intake 사이트 — status/build_type 서버 고정 */
export async function createManagedInquiryAction(form = {}) {
  const gate = await requireCustomer()
  if (!gate.ok) return fail(gate.error)

  const businessType = clip(form.businessType, 50)
  if (!businessType) return fail('업종을 선택해주세요.')

  const namePick = pickSiteOwnerPatch({ name: form.siteName })
  if (!namePick.ok) return fail(namePick.error)

  const sub = await assertSubdomainAvailable(gate.db, form.subdomain)
  if (!sub.ok) return fail(sub.error)

  const description = clip(form.description, 2000)
  if (!description) return fail('원하는 사이트 설명을 입력해주세요.')

  let templateId = null
  const { data: byCat } = await onlyActive(
    gate.db.from('templates').select('template_id').eq('category', businessType)
  ).order('sort_order').limit(1)
  templateId = byCat?.[0]?.template_id || null
  if (!templateId) {
    const { data: anyT } = await onlyActive(
      gate.db.from('templates').select('template_id')
    ).order('sort_order').limit(1)
    templateId = anyT?.[0]?.template_id || null
  }

  const phone = clip(form.phone || gate.customer.phone, 50) || null

  const { data: inq, error: inqErr } = await gate.db.from('inquiries').insert({
    customer_id: gate.customer.customer_id,
    business_type: businessType,
    description,
    phone,
  }).select('inquiry_id').single()
  if (inqErr) return fail(inqErr.message)

  const { error: sErr } = await gate.db.from('sites').insert({
    site_code: makeSiteCode(sub.value),
    customer_id: gate.customer.customer_id,
    template_id: templateId,
    name: namePick.patch.name,
    subdomain: sub.value,
    description,
    phone,
    email: gate.customer.email || null,
    build_type: 'managed',
    inquiry_id: inq.inquiry_id,
    status: 'intake',
  })
  if (sErr) {
    await gate.db.from('inquiries').update({ use_flag: 0 }).eq('inquiry_id', inq.inquiry_id)
    return fail(sErr.message)
  }
  return ok({ inquiryId: inq.inquiry_id })
}

/** auth 가입 직후 customers 행 — auth_id·email은 세션에서 */
export async function completeCustomerProfileAction({ name, phone } = {}) {
  const user = await getServerUser()
  if (!user) return fail('로그인이 필요합니다.')

  const db = createAdminClient()
  const { data: existing } = await onlyActive(
    db.from('customers').select('customer_id').eq('auth_id', user.id)
  ).maybeSingle()
  if (existing) return ok({ customerId: existing.customer_id, existed: true })

  const displayName = clip(name, 80)
  if (!displayName) return fail('이름을 입력해 주세요.')

  const { data, error } = await db.from('customers').insert([{
    auth_id: user.id,
    email: user.email,
    name: displayName,
    phone: clip(phone, 50) || null,
  }]).select('customer_id').single()
  if (error) return fail(error.message)
  return ok({ customerId: data.customer_id, existed: false })
}

/** 탈퇴 계정 재활성화 — customers.status만 (현행) */
export async function reactivateCustomerAction() {
  const gate = await requireCustomer()
  if (!gate.ok) return fail(gate.error)
  if (gate.customer.status !== 'withdrawn') return ok({ already: true })

  const { error } = await gate.db.from('customers')
    .update({ status: 'active' })
    .eq('customer_id', gate.customer.customer_id)
  if (error) return fail(error.message)
  return ok({ already: false })
}

/**
 * 탈퇴 — 현행 정책 그대로.
 * 유료 구독(해당 사이트)이면 잔여 기간 보장, 아니면 즉시 정지·탈퇴.
 */
export async function withdrawCustomerAction(siteCode) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)

  const { db, customer, site } = gate
  const { data: sub } = await onlyActive(
    db.from('subscriptions').select('*').eq('site_id', site.site_id)
  ).maybeSingle()

  const { data: allSites } = await onlyActive(
    db.from('sites').select('site_id').eq('customer_id', customer.customer_id)
  )
  const siteIds = (allSites || []).map(s => s.site_id)
  const now = new Date()

  if (isPaidSubscription(site, sub)) {
    const withdrawAt = new Date(sub.next_billing_date).toISOString()
    if (siteIds.length) {
      await db.from('subscriptions')
        .update({ cancelled_at: now.toISOString(), cancels_at: sub.next_billing_date })
        .in('site_id', siteIds)
    }
    await db.from('customers')
      .update({ withdraw_at: withdrawAt })
      .eq('customer_id', customer.customer_id)
    return ok({ pending: true, until: sub.next_billing_date })
  }

  if (siteIds.length) {
    await db.from('subscriptions')
      .update({ cancelled_at: now.toISOString(), cancels_at: null })
      .in('site_id', siteIds)
    await db.from('sites')
      .update({ status: 'suspended' })
      .in('site_id', siteIds)
  }
  await db.from('customers')
    .update({ status: 'withdrawn' })
    .eq('customer_id', customer.customer_id)
  return ok({ pending: false })
}
