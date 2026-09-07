'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { onlyActive } from '@/lib/use-flag'
import { sitePublicPath } from '@/lib/site-paths'

/**
 * sites.status = review 일 때 방문자 페이지 가드
 * 소유 고객 또는 active staff만 콘텐츠 표시
 * (상태 리본은 app/s/[siteCode]/layout.js 에서 표시)
 */
export default function ReviewSiteGate({ site, siteCode, children }) {
  const [state, setState] = useState('loading') // loading | allowed | denied

  useEffect(() => { checkAccess() }, [site?.site_id, siteCode])

  async function checkAccess() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setState('denied')
      return
    }

    const { data: staff } = await onlyActive(
      supabase
        .from('staff')
        .select('staff_id')
        .eq('auth_id', user.id)
        .eq('status', 'active')
    ).maybeSingle()
    if (staff) {
      setState('allowed')
      return
    }

    const { data: customer } = await onlyActive(
      supabase
        .from('customers')
        .select('customer_id')
        .eq('auth_id', user.id)
    ).maybeSingle()

    if (customer && customer.customer_id === site.customer_id) {
      setState('allowed')
      return
    }

    setState('denied')
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center font-sans">
        <p className="text-sm text-stone-400">확인 중...</p>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center font-sans px-5">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-stone-900 mb-2">검수용 미리보기</h1>
          <p className="text-sm text-stone-500 leading-relaxed mb-6">
            이 사이트는 검수 중입니다.<br />
            사이트 소유자 또는 관리자만 볼 수 있습니다.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(sitePublicPath(siteCode))}`}
            className="inline-block px-6 py-3 bg-stone-900 text-white rounded-lg no-underline text-sm font-semibold"
          >
            로그인
          </Link>
        </div>
      </div>
    )
  }

  return children
}
