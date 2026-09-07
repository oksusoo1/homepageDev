import { NextResponse } from 'next/server'

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'localhost:3000'
const SITE_HOST_ROOT = process.env.NEXT_PUBLIC_SITE_HOST_ROOT || 'myplatform.com'

function isPlatformHost(host) {
  if (!host) return true
  const bare = host.split(':')[0]
  if (host === PLATFORM_DOMAIN) return true
  if (/^[\d.]+$/.test(bare)) return true
  if (host.startsWith('localhost')) return true
  if (host.startsWith('spboxwin.iptime.org')) return true
  if (bare === SITE_HOST_ROOT || bare === `www.${SITE_HOST_ROOT}`) return true
  return false
}

/**
 * 고객 사이트 서브도메인 → /s/{code} 내부 rewrite
 * hongcafe.myplatform.com/board → /s/hongcafe/board
 * hongcafe.myplatform.com/admin → /s/hongcafe/admin
 */
export function proxy(request) {
  const host = request.headers.get('host') || ''
  const url = request.nextUrl.clone()

  if (isPlatformHost(host)) {
    return NextResponse.next()
  }

  const bareHost = host.split(':')[0]
  const rootSuffix = `.${SITE_HOST_ROOT}`

  if (!bareHost.endsWith(rootSuffix)) {
    return NextResponse.next()
  }

  const sub = bareHost.slice(0, -rootSuffix.length)
  if (!sub || sub === 'www' || sub.includes('.')) {
    return NextResponse.next()
  }

  if (url.pathname.startsWith('/s/')) {
    return NextResponse.next()
  }

  url.pathname = `/s/${sub}${url.pathname === '/' ? '' : url.pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
