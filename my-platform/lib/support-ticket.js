/**
 * 고객 요청(support_tickets) 대화
 * - customer = 사장님 · staff = 직원
 * - is_internal = true 는 직원 내부 메모. **고객 조회 쿼리에서 아예 제외** (화면 필터에 의존하지 않음)
 */

import { onlyActive } from '@/lib/use-flag'

/** 직원용 — 내부 메모 포함 */
export async function loadTicketMessages(supabase, ticketIds) {
  if (!ticketIds?.length) return {}
  const { data } = await onlyActive(
    supabase.from('support_ticket_messages').select('*').in('ticket_id', ticketIds).order('created_at')
  )
  return groupByTicket(data)
}

/** 사장님용 — 내부 메모 제외 (쿼리 단계에서 차단) */
export async function loadCustomerTicketMessages(supabase, ticketIds) {
  if (!ticketIds?.length) return {}
  const { data } = await onlyActive(
    supabase.from('support_ticket_messages')
      .select('ticket_message_id, ticket_id, author_type, author, content, created_at, read_at')
      .in('ticket_id', ticketIds)
      .eq('is_internal', false)
      .order('created_at')
  )
  return groupByTicket(data)
}

function groupByTicket(rows) {
  const out = {}
  for (const m of rows || []) (out[m.ticket_id] ||= []).push(m)
  return out
}

/**
 * @param {{ ticketId: string, authorType: 'customer'|'staff', author: string, content: string, isInternal?: boolean }} msg
 */
export async function addTicketMessage(supabase, { ticketId, authorType, author, content, isInternal = false }) {
  const text = (content || '').trim()
  if (!text) throw new Error('내용을 입력해 주세요.')
  const { error } = await supabase.from('support_ticket_messages').insert({
    ticket_id: ticketId,
    author_type: authorType,
    author: author || (authorType === 'staff' ? '본사' : '고객'),
    content: text,
    is_internal: authorType === 'staff' ? !!isInternal : false,
  })
  if (error) throw new Error(error.message)
}

/**
 * 읽음 처리 — 상대방이 보낸 안 읽은 메시지에 read_at 기록
 * @param {'customer'|'staff'} reader 읽는 쪽
 * @returns {Promise<boolean>} 실제로 읽음 처리한 게 있으면 true
 */
export async function markTicketMessagesRead(supabase, ticketIds, reader) {
  if (!ticketIds?.length) return false
  const from = reader === 'customer' ? 'staff' : 'customer'
  const q = supabase.from('support_ticket_messages')
    .update({ read_at: new Date().toISOString() })
    .in('ticket_id', ticketIds)
    .eq('author_type', from)
    .eq('use_flag', 1)
    .is('read_at', null)
  // 내부 메모는 고객에게 가지 않으므로 읽음 대상 아님
  const { data, error } = await (from === 'staff' ? q.eq('is_internal', false) : q).select('ticket_message_id')
  if (error) return false
  return (data || []).length > 0
}

/** 안 읽은 메시지 (상대가 보낸 것) */
export function unreadFrom(messages, authorType) {
  return (messages || []).filter(m => m.author_type === authorType && !m.read_at && !m.is_internal)
}

/** 고객에게 보인 마지막 직원 메시지 (완료 가능 여부 판단) */
export function lastStaffReply(messages) {
  return [...(messages || [])].reverse().find(m => m.author_type === 'staff' && !m.is_internal) || null
}

/** 사장님이 요청을 고치거나 취소할 수 있는 단계 */
export function canCustomerEditTicket(ticket) {
  return ticket?.status === 'open'
}
