import { NextResponse } from 'next/server'

// 플랫폼 자체 도메인 (관리자 화면)
const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'localhost:3000'

export function proxy(request) {
  const host = request.headers.get('host') || ''
  const url = request.nextUrl.clone()

  // 플랫폼 관리자 도메인이면 그대로 통과 (IP 주소 접근 포함)
  const isIp = /^[\d.]+/.test(host)
  const isDevHost = host.startsWith('localhost') || host.startsWith('spboxwin.iptime.org')
  if (host === PLATFORM_DOMAIN || isIp || isDevHost) {
    return NextResponse.next()
  }

  // 서브도메인 처리: aaa.우리플랫폼.com
  // → /[domain]/... 으로 rewrite
  const subdomain = host.split('.')[0]

  // 이미 /[domain]/ 경로면 통과
  if (url.pathname.startsWith(`/${subdomain}`)) {
    return NextResponse.next()
  }

  // 고객 사이트로 rewrite
  url.pathname = `/${host}${url.pathname}`
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
