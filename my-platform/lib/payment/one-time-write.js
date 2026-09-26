import 'server-only'
import { getStageAmount, stageMeta } from '@/lib/payment/one-time'

async function upsertStagePayment(db, { customerId, siteId, stage, amount, status, note, paidAt = null }) {
  let q = db
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
    const { error } = await db.from('one_time_payments').update(payload).eq('payment_id', existing.payment_id)
    if (error) throw new Error(error.message)
    return existing.payment_id
  }
  const { error } = await db.from('one_time_payments').insert({
    customer_id: customerId, site_id: siteId || null, type: 'dev_fee', stage, use_flag: 1, ...payload,
  })
  if (error) throw new Error(error.message)
  return null
}

export async function submitStageBankTransfer(db, { inquiry, customerId, siteId, depositorName, stage }) {
  const name = (depositorName || '').trim()
  if (!name) return { error: '입금자명을 입력해 주세요.' }

  try {
    await upsertStagePayment(db, {
      customerId, siteId, stage,
      amount: getStageAmount(inquiry),
      status: 'pending_confirm',
      note: `개발비 ${stageMeta(stage).label} 입금 확인 요청 · 입금자: ${name}`,
    })
  } catch (e) {
    return { error: e.message }
  }

  if (stage === 'final' && siteId) {
    await db.from('sites')
      .update({ status: 'balance', updated_at: new Date().toISOString() })
      .eq('site_id', siteId)
      .eq('use_flag', 1)
  }

  return { error: null, pending: true }
}

export async function completeStageCardMock(db, { inquiryId, customerId, siteId, inquiry, stage }) {
  const now = new Date().toISOString()
  const amount = getStageAmount(inquiry)

  const patch = stage === 'down'
    ? { down_paid_at: now, updated_at: now }
    : { final_paid_at: now, updated_at: now }

  const { error } = await db.from('inquiries').update(patch).eq('inquiry_id', inquiryId)
  if (error) return { error: error.message }

  try {
    await upsertStagePayment(db, {
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
    const { data: site } = await db
      .from('sites').select('site_id').eq('inquiry_id', inquiryId).eq('use_flag', 1).maybeSingle()
    targetSiteId = site?.site_id || null
  }
  if (targetSiteId) {
    await db.from('sites').update({ status: nextStatus, updated_at: now }).eq('site_id', targetSiteId)
  }

  return { error: null }
}
