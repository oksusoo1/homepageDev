'use client'

import { useEffect } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'

/** 레거시 preview contact → /s/{siteCode}/contact */
export default function LegacyContactRedirect({ params }) {
  const { domain } = use(params)
  const router = useRouter()
  const siteCode = domain.split('.')[0]

  useEffect(() => {
    router.replace(`/s/${siteCode}/contact`)
  }, [siteCode, router])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#78716c', fontSize: 14 }}>
      문의 페이지로 이동 중...
    </div>
  )
}
