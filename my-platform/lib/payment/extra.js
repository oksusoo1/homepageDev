/**
 * 추가 작업 견적 — 운영 중 사이트의 유료 요청
 * one_time_payments(type='extra', ticket_id=요청) 1행이 곧 견적
 *   unpaid          : 견적 발송, 결제 전
 *   pending_confirm : 계좌이체 입금 확인 요청
 *   paid            : 결제 완료 → 직원 작업
 * 견적 철회·거절 = use_flag 0
 */

import { onlyActive } from '@/lib/use-flag'

export const QUOTE_LABEL = {
  unpaid: '결제 대기',
  pending_confirm: '입금 확인 대기',
  paid: '결제 완료',
}

export function quoteLabel(status) {
  return QUOTE_LABEL[status] || status
}

/** 요청들의 견적 (ticket_id → 결제행) */
export async function loadTicketQuotes(supabase, ticketIds) {
  if (!ticketIds?.length) return {}
  const { data } = await onlyActive(
    supabase.from('one_time_payments')
      .select('payment_id, ticket_id, site_id, amount, status, note, paid_at, created_at')
      .in('ticket_id', ticketIds)
      .eq('type', 'extra')
  )
  const out = {}
  for (const p of data || []) out[p.ticket_id] = p
  return out
}

/** 견적 1건 (결제 화면) */
export async function loadQuote(supabase, paymentId, customerId) {
  const { data } = await onlyActive(
    supabase.from('one_time_payments')
      .select('*, sites(site_id, name, subdomain), support_tickets(ticket_id, title, content)')
      .eq('payment_id', paymentId)
      .eq('customer_id', customerId)
      .eq('type', 'extra')
  ).maybeSingle()

  if (!data) return { ok: false, error: '견적을 찾을 수 없습니다.' }
  if (data.status === 'paid') return { ok: false, error: '이미 결제가 완료된 작업입니다.' }
  if (data.status === 'pending_confirm') {
    return { ok: false, error: '입금 확인을 이미 요청하셨습니다. 본사 확인을 기다려 주세요.' }
  }
  return { ok: true, quote: data }
}

/** 직원 — 견적 보내기 (요청에 금액 붙이기) */
export async function sendQuote(supabase, { ticket, amount, note }) {
  const num = parseInt(amount, 10)
  if (isNaN(num) || num <= 0) throw new Error('금액을 정확히 입력해 주세요.')

  const { data: existing } = await onlyActive(
    supabase.from('one_time_payments').select('payment_id, status')
      .eq('ticket_id', ticket.ticket_id).eq('type', 'extra')
  ).maybeSingle()

  if (existing?.status === 'paid') throw new Error('이미 결제된 견적이 있습니다.')

  const payload = {
    amount: num,
    status: 'unpaid',
    note: (note || '').trim() || `추가 작업: ${ticket.title}`,
  }

  if (existing) {
    const { error } = await supabase.from('one_time_payments').update(payload).eq('payment_id', existing.payment_id)
    if (error) throw new Error(error.message)
    return
  }
  const { error } = await supabase.from('one_time_payments').insert({
    customer_id: ticket.customer_id,
    site_id: ticket.site_id,
    ticket_id: ticket.ticket_id,
    type: 'extra',
    use_flag: 1,
    ...payload,
  })
  if (error) throw new Error(error.message)
}

/** 견적 철회(직원) · 거절(고객) — 결제 전만 */
export async function cancelQuote(supabase, paymentId) {
  const { error } = await supabase.from('one_time_payments')
    .update({ use_flag: 0 })
    .eq('payment_id', paymentId)
    .in('status', ['unpaid', 'pending_confirm'])
  if (error) throw new Error(error.message)
}

/** 고객 — 계좌이체 입금 확인 요청 */
export async function requestQuoteBankTransfer(supabase, { quote, depositorName }) {
  const name = (depositorName || '').trim()
  if (!name) return { error: '입금자명을 입력해 주세요.' }
  const { error } = await supabase.from('one_time_payments')
    .update({
      status: 'pending_confirm',
      note: `${quote.note || '추가 작업'} · 입금 확인 요청 (입금자: ${name})`,
    })
    .eq('payment_id', quote.payment_id)
  if (error) return { error: error.message }
  return { error: null }
}

/** 고객 — 카드 결제 목업 (즉시 완료) */
export async function payQuoteCardMock(supabase, { quote }) {
  const now = new Date().toISOString()
  const { error } = await supabase.from('one_time_payments')
    .update({ status: 'paid', paid_at: now, note: `${quote.note || '추가 작업'} · 카드결제(목업)` })
    .eq('payment_id', quote.payment_id)
  if (error) return { error: error.message }
  return { error: null }
}
