import 'server-only'

export async function addTicketMessage(db, { ticketId, authorType, author, content, isInternal = false }) {
  const text = (content || '').trim()
  if (!text) throw new Error('내용을 입력해 주세요.')
  if (text.length > 5000) throw new Error('메시지가 너무 깁니다.')
  const { error } = await db.from('support_ticket_messages').insert({
    ticket_id: ticketId,
    author_type: authorType,
    author: author || (authorType === 'staff' ? '본사' : '고객'),
    content: text,
    is_internal: authorType === 'staff' ? !!isInternal : false,
  })
  if (error) throw new Error(error.message)
}

export async function markTicketMessagesRead(db, ticketIds, reader) {
  if (!ticketIds?.length) return false
  const from = reader === 'customer' ? 'staff' : 'customer'
  const q = db.from('support_ticket_messages')
    .update({ read_at: new Date().toISOString() })
    .in('ticket_id', ticketIds)
    .eq('author_type', from)
    .eq('use_flag', 1)
    .is('read_at', null)
  const { data, error } = await (from === 'staff' ? q.eq('is_internal', false) : q).select('ticket_message_id')
  if (error) return false
  return (data || []).length > 0
}
