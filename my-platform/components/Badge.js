/**
 * 상태 뱃지 컴포넌트
 * platform, my/[subdomain] 등에서 공통 사용
 */
export default function Badge({ color, bg, children }) {
  const bgColor = bg || (color + '18')
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: bgColor,
      color,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}
