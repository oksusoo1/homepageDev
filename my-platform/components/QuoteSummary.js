/**
 * 추가 작업 견적 요약 (고객용) — 무엇을 얼마에 하는지
 */
export default function QuoteSummary({ quote }) {
  if (!quote) return null
  const ticket = quote.support_tickets

  return (
    <div style={{ background: '#fafafa', borderRadius: 10, padding: '14px 16px', border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 8, letterSpacing: 0.5 }}>
        추가 작업 견적
      </div>
      {ticket?.title && (
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{ticket.title}</div>
      )}
      {quote.note && (
        <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#6b7280', lineHeight: 1.6 }}>{quote.note}</p>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>결제 금액</span>
        <strong style={{ fontSize: 16, color: '#b45309' }}>{quote.amount?.toLocaleString()}원</strong>
      </div>
    </div>
  )
}
