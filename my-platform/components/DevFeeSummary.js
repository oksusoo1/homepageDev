import { getDevFeeBreakdown } from '@/lib/payment/one-time'

/**
 * 개발비 총액 · 선금 · 잔금 요약 (고객용)
 * @param {'none'|'final'} highlight
 * @param {boolean} finalPending - one_time_payments.status=pending_confirm
 */
export default function DevFeeSummary({ inquiry, highlight = 'none', finalPending = false }) {
  const fee = getDevFeeBreakdown(inquiry, { finalPending })
  if (!fee) return null

  const statusLabel = (status) => {
    if (status === 'paid') return '✓ 납부'
    if (status === 'pending') return '입금확인 중'
    if (status === 'due') return '납부 필요'
    return '미납'
  }

  const statusColor = (status) => {
    if (status === 'paid') return '#16a34a'
    if (status === 'pending') return '#2563eb'
    if (status === 'due') return '#d97706'
    return '#9ca3af'
  }

  const row = (label, amount, status, emphasized = false) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0', fontSize: 13,
      borderBottom: '1px solid #f3f4f6',
      ...(emphasized ? {
        background: status === 'pending' ? '#eff6ff' : '#fffbeb',
        margin: '0 -12px', padding: '10px 12px', borderRadius: 8,
        border: status === 'pending' ? '1px solid #bfdbfe' : '1px solid #fde68a',
      } : {}),
    }}>
      <span style={{
        color: emphasized ? (status === 'pending' ? '#1e40af' : '#92400e') : '#6b7280',
        fontWeight: emphasized ? 700 : 500,
      }}>{label}</span>
      <span style={{
        fontWeight: emphasized ? 800 : 600,
        color: emphasized ? (status === 'pending' ? '#1d4ed8' : '#b45309') : '#111827',
      }}>
        {amount.toLocaleString()}원
        {status && (
          <span style={{
            marginLeft: 8, fontSize: 11, fontWeight: 600,
            color: statusColor(status),
          }}>
            {statusLabel(status)}
          </span>
        )}
      </span>
    </div>
  )

  let finalStatus = 'unpaid'
  let finalLabel = '잔금 (50%)'
  let emphasizeFinal = false
  if (fee.finalPaid) {
    finalStatus = 'paid'
  } else if (fee.finalPending) {
    finalStatus = 'pending'
    finalLabel = '잔금 (50%) — 입금확인 중'
    emphasizeFinal = highlight === 'final'
  } else if (highlight === 'final') {
    finalStatus = 'due'
    finalLabel = '잔금 (50%) — 지금 납부'
    emphasizeFinal = true
  }

  return (
    <div style={{
      background: '#fafafa', borderRadius: 10, padding: '12px 14px',
      border: '1px solid #e5e7eb', marginBottom: highlight === 'final' ? 12 : 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 6, letterSpacing: 0.5 }}>
        개발비 정산
      </div>
      {row('총 개발비', fee.total)}
      {row('선금 (50%)', fee.downPayment, fee.downPaid ? 'paid' : 'unpaid')}
      {row(finalLabel, fee.finalPayment, finalStatus, emphasizeFinal)}
      {fee.finalPending && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#1e40af', lineHeight: 1.5 }}>
          잔금 <strong>{fee.finalPayment.toLocaleString()}원</strong> 입금 신청이 접수되었습니다.
          본사에서 통장 확인 후 서비스 시작 단계로 안내드립니다. (보통 1~2영업일)
        </p>
      )}
      {!fee.finalPaid && !fee.finalPending && fee.remaining > 0 && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
          총 <strong>{fee.total.toLocaleString()}원</strong> 중 선금을 납부하셨습니다.
          남은 잔금 <strong style={{ color: '#b45309' }}>{fee.remaining.toLocaleString()}원</strong>을 결제해 주세요.
        </p>
      )}
    </div>
  )
}
