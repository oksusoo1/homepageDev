'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { requireAuthUser } from '@/lib/auth'
import { onlyActive } from '@/lib/use-flag'
import { sitePublicPath } from '@/lib/site-paths'
import { canViewByVisibility } from '@/lib/site-visibility'

/**
 * /s/... 공개 범위 게이트
 * - public: 통과
 * - partial: 본사 또는 소유 고객
 * - producer: 대리=본사만 / 셀프=소유 고객만
 * - hidden: 정지 안내
 */
export default function SiteVisibilityGate({ site, siteCode, visibility: visibilityProp, children }) {
  const [state, setState] = useState('loading') // loading | allowed | denied | hidden

  const resolved = visibilityProp || (() => {
    if (!site) return 'hidden'
    if (site.status === 'suspended' || site.status === 'cancelled') return 'hidden'
    if (site.status === 'published') return 'public'
    if (site.status === 'review') return 'partial'
    return 'producer'
  })()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (resolved === 'public') {
        if (!cancelled) setState('allowed')
        return
      }
      if (resolved === 'hidden') {
        if (!cancelled) setState('hidden')
        return
      }

      const user = await requireAuthUser()
      if (cancelled) return
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
      if (cancelled) return

      let isOwner = false
      const { data: customer } = await onlyActive(
        supabase
          .from('customers')
          .select('customer_id')
          .eq('auth_id', user.id)
      ).maybeSingle()
      if (cancelled) return
      if (customer && customer.customer_id === site?.customer_id) {
        isOwner = true
      }

      const ok = canViewByVisibility(resolved, site?.build_type, {
        isStaff: !!staff,
        isOwner,
      })
      setState(ok ? 'allowed' : 'denied')
    })()
    return () => { cancelled = true }
  }, [resolved, site?.customer_id, site?.build_type, site?.site_id])

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center font-sans">
        <p className="text-sm text-stone-400">확인 중...</p>
      </div>
    )
  }

  if (state === 'hidden') {
    return (
      <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center font-sans px-5">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-stone-900 mb-2">사이트 준비 중입니다</h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            현재 이 사이트는 이용이 중단되었습니다.
          </p>
        </div>
      </div>
    )
  }

  if (state === 'denied') {
    const isProducer = resolved === 'producer'
    return (
      <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center font-sans px-5">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">{isProducer ? '🛠' : '🔍'}</div>
          <h1 className="text-xl font-bold text-stone-900 mb-2">
            {isProducer ? '제작 중입니다' : '부분 공개'}
          </h1>
          <p className="text-sm text-stone-500 leading-relaxed mb-6">
            {isProducer
              ? <>제작하는 사람만 볼 수 있습니다.<br />일반 공개 전입니다.</>
              : <>본사 또는 사이트 소유자만 볼 수 있습니다.</>}
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
