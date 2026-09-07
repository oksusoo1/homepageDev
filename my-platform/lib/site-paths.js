/**
 * 사이트 Realm URL 헬퍼 (플로우 v1.3.2)
 * path: /s/{siteCode}/...
 * domain: {siteCode}.myplatform.com (proxy rewrite)
 */

const SITE_HOST_ROOT = process.env.NEXT_PUBLIC_SITE_HOST_ROOT || 'myplatform.com'

/** 방문자 페이지 경로 */
export function sitePublicPath(siteCode, subPath = '') {
  const base = `/s/${siteCode}`
  if (!subPath) return base
  return `${base}${subPath.startsWith('/') ? subPath : `/${subPath}`}`
}

/** 사이트 관리(고객 콘솔) 경로 */
export function siteAdminPath(siteCode, subPath = '') {
  const base = `/s/${siteCode}/admin`
  if (!subPath) return base
  return `${base}${subPath.startsWith('/') ? subPath : `/${subPath}`}`
}

/** 결제 수단 선택 */
export function paymentMethodPath(siteCode, redirect = 'deploy') {
  const q = new URLSearchParams()
  if (redirect) q.set('redirect', redirect)
  const qs = q.toString()
  return `${siteAdminPath(siteCode, '/payment/method')}${qs ? `?${qs}` : ''}`
}

/** 카드 등록 */
export function paymentCardPath(siteCode, redirect = '') {
  const q = new URLSearchParams()
  if (redirect) q.set('redirect', redirect)
  const qs = q.toString()
  return `${siteAdminPath(siteCode, '/payment/card')}${qs ? `?${qs}` : ''}`
}

/** 계좌이체 등록 */
export function paymentBankTransferPath(siteCode, redirect = '') {
  const q = new URLSearchParams()
  if (redirect) q.set('redirect', redirect)
  const qs = q.toString()
  return `${siteAdminPath(siteCode, '/payment/bank-transfer')}${qs ? `?${qs}` : ''}`
}

/** 카드 등록 성공 */
export function paymentCardSuccessPath(siteCode, mock = false) {
  const q = new URLSearchParams()
  if (mock) q.set('mock', 'true')
  const qs = q.toString()
  return `${siteAdminPath(siteCode, '/payment/card/success')}${qs ? `?${qs}` : ''}`
}

/** 카드 등록 실패 */
export function paymentCardFailPath(siteCode) {
  return siteAdminPath(siteCode, '/payment/card/fail')
}

/** 고객에게 보여줄 공개 URL (서브도메인) */
export function sitePublicHostname(siteCode) {
  return `${siteCode}.${SITE_HOST_ROOT}`
}

export function sitePublicUrl(siteCode, subPath = '') {
  const path = subPath ? (subPath.startsWith('/') ? subPath : `/${subPath}`) : ''
  return `https://${sitePublicHostname(siteCode)}${path}`
}
