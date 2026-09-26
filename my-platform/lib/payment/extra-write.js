import 'server-only'
import { onlyActive } from '@/lib/use-flag'

export async function sendQuote(db, { ticket, amount, note }) {
  const num = parseInt(amount, 10)
  if (isNaN(num) || num <= 0) throw new Error('금액을 정확히 입력해 주세요.')

  const { data: existing } = await onlyActive(
    db.from('one_time_payments').select('payment_id, status')
      .eq('ticket_id', ticket.ticket_id).eq('type', 'extra')
  ).maybeSingle()

  if (existing?.status === 'paid') throw new Error('이미 결제된 견적이 있습니다.')

  const payload = {
    amount: num,
    status: 'unpaid',
    note: (note || '').trim() || `추가 작업: ${ticket.title}`,
  }

  if (existing) {
    const { error } = await db.from('one_time_payments').update(payload).eq('payment_id', existing.payment_id)
    if (error) throw new Error(error.message)
    return
  }
  const { error } = await db.from('one_time_payments').insert({
    customer_id: ticket.customer_id,
    site_id: ticket.site_id,
    ticket_id: ticket.ticket_id,
    type: 'extra',
    use_flag: 1,
    ...payload,
  })
  if (error) throw new Error(error.message)
}

export async function cancelQuote(db, paymentId) {
  const { error } = await db.from('one_time_payments')
    .update({ use_flag: 0 })
    .eq('payment_id', paymentId)
    .in('status', ['unpaid', 'pending_confirm'])
  if (error) throw new Error(error.message)
}

export async function requestQuoteBankTransfer(db, { quote, depositorName }) {
  const name = (depositorName || '').trim()
  if (!name) return { error: '입금자명을 입력해 주세요.' }
  const { error } = await db.from('one_time_payments')
    .update({
      status: 'pending_confirm',
      note: `${quote.note || '추가 작업'} · 입금 확인 요청 (입금자: ${name})`,
    })
    .eq('payment_id', quote.payment_id)
  if (error) return { error: error.message }
  return { error: null }
}

export async function payQuoteCardMock(db, { quote }) {
  const now = new Date().toISOString()
  const { error } = await db.from('one_time_payments')
    .update({ status: 'paid', paid_at: now, note: `${quote.note || '추가 작업'} · 카드결제(목업)` })
    .eq('payment_id', quote.payment_id)
  if (error) return { error: error.message }
  return { error: null }
}
