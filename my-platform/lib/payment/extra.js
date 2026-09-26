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

