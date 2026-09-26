'use server'

import { requireOwnedInquiry } from '@/lib/server/guard'
import { canCancelManagedIntake, cancelManagedIntake } from '@/lib/managed-flow'
import {
  loadInquiryForPayment,
  submitStageBankTransfer,
  completeStageCardMock,
  stageMeta,
} from '@/lib/payment/one-time'

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
