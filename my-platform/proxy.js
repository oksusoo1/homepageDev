import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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

function withSessionCookies(response, cookiesToSet) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })
  return response
}

/**
 * 고객 사이트 서브도메인 → /s/{code} 내부 rewrite
 * + 세션 쿠키 갱신 (rewrite 경로는 그대로)
 */
export async function proxy(request) {
  const cookiesToSet = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.push(...toSet)
        },
      },
    }
  )

  await supabase.auth.getUser()

  const host = request.headers.get('host') || ''
  const url = request.nextUrl.clone()

  if (isPlatformHost(host)) {
    return withSessionCookies(NextResponse.next(), cookiesToSet)
  }

  const bareHost = host.split(':')[0]
  const rootSuffix = `.${SITE_HOST_ROOT}`

  if (!bareHost.endsWith(rootSuffix)) {
    return withSessionCookies(NextResponse.next(), cookiesToSet)
  }

  const sub = bareHost.slice(0, -rootSuffix.length)
  if (!sub || sub === 'www' || sub.includes('.')) {
    return withSessionCookies(NextResponse.next(), cookiesToSet)
  }

  if (url.pathname.startsWith('/s/')) {
    return withSessionCookies(NextResponse.next(), cookiesToSet)
  }

  url.pathname = `/s/${sub}${url.pathname === '/' ? '' : url.pathname}`
  return withSessionCookies(NextResponse.rewrite(url), cookiesToSet)
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
