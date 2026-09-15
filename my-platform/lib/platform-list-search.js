/**
 * 플랫폼 목록 조회용 — 탭마다 같은 패턴으로 재사용
 * @param {string} query
 * @param {...(string|null|undefined)} parts 검색 대상 문자열
 */
export function matchesSearchQuery(query, ...parts) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return true
  const hay = parts.filter(Boolean).join(' ').toLowerCase()
  return hay.includes(q)
}
