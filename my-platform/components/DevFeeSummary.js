import { getDevFeeBreakdown, stageMeta } from '@/lib/payment/one-time'

/**
 * 개발비 총액 · 선금 · 잔금 요약 (고객용)
 * @param {'none'|'down'|'final'} highlight 지금 납부할 단계
 * @param {boolean} finalPending / downPending - one_time_payments.status=pending_confirm
 */
export default function DevFeeSummary({ inquiry, highlight = 'none', finalPending = false, downPending = false }) {
  const fee = getDevFeeBreakdown(inquiry, { finalPending, downPending })
  if (!fee) return null

  const statusLabel = (status) => {
    if (status === 'paid') return '✓ 납부'
    if (status === 'pending') return '확인 대기'
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
        color: emphasized ? (status === 'pending' ? '#1e40af' : '#92400e') : '#111827',
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

  /** 단계별 상태·라벨 (선금·잔금 공통) */
  const stageRow = (stage) => {
    const paid = stage === 'down' ? fee.downPaid : fee.finalPaid
    const pending = stage === 'down' ? fee.downPending : fee.finalPending
    const amount = stage === 'down' ? fee.downPayment : fee.finalPayment
    const base = `${stageMeta(stage).label} (50%)`
    if (paid) return row(base, amount, 'paid')
    if (pending) return row(`${base} — 본사 확인 대기`, amount, 'pending', highlight === stage)
    if (highlight === stage) return row(`${base} — 지금 납부`, amount, 'due', true)
    return row(base, amount, 'unpaid')
  }

  const pendingStage = fee.downPending ? 'down' : fee.finalPending ? 'final' : null
  const pendingAmount = pendingStage === 'down' ? fee.downPayment : fee.finalPayment

  return (
    <div style={{
      background: '#fafafa', borderRadius: 10, padding: '12px 14px',
      border: '1px solid #e5e7eb', marginBottom: highlight === 'none' ? 0 : 12,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 6, letterSpacing: 0.5 }}>
        개발비 정산
      </div>
      {row('총 개발비', fee.total)}
      {stageRow('down')}
      {stageRow('final')}

      {pendingStage && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#1e40af', lineHeight: 1.5 }}>
          {stageMeta(pendingStage).label} <strong>{pendingAmount.toLocaleString()}원</strong> 입금 확인을 요청하셨습니다.
          본사에서 통장 확인 후 다음 단계로 안내드립니다. (보통 1~2영업일)
        </p>
      )}
      {!pendingStage && fee.downPaid && !fee.finalPaid && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
          선금은 납부되었습니다. 남은 잔금 <strong style={{ color: '#b45309' }}>{fee.finalPayment.toLocaleString()}원</strong>은 검수 후 결제합니다.
        </p>
      )}
    </div>
  )
}
