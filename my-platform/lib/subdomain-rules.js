/** 사이트 주소(subdomain) 규칙 — 화면·서버 공통. 서버 검사가 최종. */

export const SUBDOMAIN_MIN = 3
export const SUBDOMAIN_MAX = 30

export const RESERVED_SUBDOMAINS = Object.freeze([
  'www', 'admin', 'api', 'platform', 'my', 'login', 's', 'app',
  'mail', 'test', 'dev', 'staging', 'static', 'cdn', 'help', 'support',
])

const RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/

export function normalizeSubdomain(raw) {
  return String(raw || '').trim().toLowerCase()
}

/**
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function validateSubdomain(raw) {
  const value = normalizeSubdomain(raw)
  if (!value) return { ok: false, error: '사이트 주소를 입력해 주세요.' }
  if (value.length < SUBDOMAIN_MIN) {
    return { ok: false, error: `사이트 주소는 ${SUBDOMAIN_MIN}자 이상이어야 해요.` }
  }
  if (value.length > SUBDOMAIN_MAX) {
    return { ok: false, error: `사이트 주소는 ${SUBDOMAIN_MAX}자까지예요.` }
  }
  if (/[A-Z]/.test(String(raw || '').trim())) {
    return { ok: false, error: '사이트 주소는 영문 소문자만 사용할 수 있어요.' }
  }
  if (value.startsWith('-') || value.endsWith('-')) {
    return { ok: false, error: '사이트 주소는 하이픈으로 시작하거나 끝날 수 없어요.' }
  }
  if (!RE.test(value)) {
    return { ok: false, error: '영문 소문자, 숫자, 하이픈만 쓸 수 있어요.' }
  }
  if (RESERVED_SUBDOMAINS.includes(value)) {
    return { ok: false, error: '이 주소는 사용할 수 없어요. 다른 주소를 입력해 주세요.' }
  }
  return { ok: true, value }
}

/** sites.site_code VARCHAR(50) — subdomain + _ + timestamp */
export function makeSiteCode(subdomain) {
  const ts = String(Date.now())
  const budget = 50 - 1 - ts.length
  const sub = String(subdomain).slice(0, Math.max(1, budget))
  return `${sub}_${ts}`
}
