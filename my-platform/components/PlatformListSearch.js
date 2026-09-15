'use client'

/**
 * 본사 콘솔 목록 조회 바 (사이트/회원/구독 등 재사용)
 * - 입력 후 「조회」로 적용, 「초기화」로 해제
 */
export default function PlatformListSearch({
  value,
  onChange,
  onSearch,
  onReset,
  placeholder = '사이트명, 주소명, 고객명, 이메일',
  applied = false,
  resultLabel = null,
}) {
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSearch?.()
    }
  }

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
      marginBottom: 12,
    }}>
      <input
        type="text"
        value={value}
        onChange={e => onChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{
          flex: '1 1 220px', minWidth: 180, maxWidth: 420,
          padding: '8px 12px', borderRadius: 7,
          border: '1px solid #334155', background: '#0f172a',
          color: '#e2e8f0', fontSize: 13, outline: 'none',
        }}
      />
      <button
        type="button"
        onClick={() => onSearch?.()}
        style={{
          padding: '8px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
          background: '#2563eb', color: 'white', fontSize: 13, fontWeight: 700,
        }}
      >
        조회
      </button>
      <button
        type="button"
        onClick={() => onReset?.()}
        style={{
          padding: '8px 12px', borderRadius: 7, cursor: 'pointer',
          background: 'transparent', color: '#94a3b8', fontSize: 12, fontWeight: 600,
          border: '1px solid #334155',
        }}
      >
        초기화
      </button>
      {applied && resultLabel != null && (
        <span style={{ fontSize: 12, color: '#64748b' }}>{resultLabel}</span>
      )}
    </div>
  )
}
