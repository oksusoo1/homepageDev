'use client'

/**
 * 본사 콘솔 목록 조회 바 (사이트/회원/고객요청 공용)
 * - 입력 후 「조회」(또는 Enter)로 **DB에서 다시 읽고** 적용, 「초기화」로 해제
 * - 적용 여부·결과 건수·조회 시각을 표시해 눌렀는지 바로 알 수 있게 한다
 */
export default function PlatformListSearch({
  value,
  onChange,
  onSearch,
  onReset,
  placeholder = '사이트명, 주소명, 고객명, 이메일',
  applied = false,
  appliedQuery = '',
  resultLabel = null,
  busy = false,
  loadedAt = null,
}) {
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSearch?.()
    }
  }

  const dirty = (value || '') !== (appliedQuery || '')

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <input
        type="text"
        value={value}
        onChange={e => onChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{
          flex: '1 1 220px', minWidth: 180, maxWidth: 420,
          padding: '8px 12px', borderRadius: 7,
          border: `1px solid ${dirty ? '#2563eb' : '#334155'}`, background: '#0f172a',
          color: '#e2e8f0', fontSize: 13, outline: 'none',
        }}
      />
      <button
        type="button"
        onClick={() => onSearch?.()}
        disabled={busy}
        style={{
          padding: '8px 14px', borderRadius: 7, border: 'none',
          cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
          background: '#2563eb', color: 'white', fontSize: 13, fontWeight: 700,
        }}
      >
        {busy ? '조회 중…' : '조회'}
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

      {/* 눌렀는지 바로 알 수 있게 — 적용된 검색어와 건수를 항상 표시 */}
      {resultLabel != null && (
        <span style={{ fontSize: 12, color: dirty ? '#fbbf24' : '#64748b' }}>
          {dirty
            ? '「조회」를 눌러 적용하세요'
            : applied
              ? `‘${appliedQuery}’ 검색 · ${resultLabel}`
              : resultLabel}
          {!dirty && loadedAt && (
            <span style={{ marginLeft: 8, color: '#475569' }}>
              {new Date(loadedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 기준
            </span>
          )}
        </span>
      )}
    </div>
  )
}
