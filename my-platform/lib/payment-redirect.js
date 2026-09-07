'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { onlyActive } from '@/lib/use-flag'
import {
  paymentBankTransferPath,
  paymentCardFailPath,
  paymentCardPath,
  paymentCardSuccessPath,
  paymentMethodPath,
  siteAdminPath,
} from '@/lib/site-paths'

const LOADING = (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f7f4' }}>
    <div style={{ color: '#9ca3af', fontSize: 14 }}>이동 중...</div>
  </div>
)

/** 레거시 /payment/* → /s/{code}/admin/payment/* 리다이렉트 */
export function useLegacyPaymentRedirect(target) {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    async function go() {
      const siteId = searchParams.get('site_id')
      const redirect = searchParams.get('redirect') || ''
      const mock = searchParams.get('mock')

      if (!siteId) {
        router.replace('/my')
        return
      }

      const { data } = await onlyActive(
        supabase
          .from('sites')
          .select('subdomain')
          .eq('site_id', siteId)
      ).maybeSingle()

      if (!data?.subdomain) {
        router.replace('/my')
        return
      }

      const code = data.subdomain
      let dest = siteAdminPath(code, '/payment')

      switch (target) {
        case 'method':
          dest = paymentMethodPath(code, redirect || 'deploy')
          break
        case 'card':
          dest = paymentCardPath(code, redirect)
          break
        case 'bank-transfer':
          dest = paymentBankTransferPath(code, redirect)
          break
        case 'card-success':
          dest = paymentCardSuccessPath(code, mock === 'true')
          break
        case 'card-fail':
          dest = paymentCardFailPath(code)
          break
        default:
          break
      }

      router.replace(dest)
    }

    go()
  }, [router, searchParams, target])
}

export function LegacyPaymentRedirect({ target }) {
  useLegacyPaymentRedirect(target)
  return LOADING
}
