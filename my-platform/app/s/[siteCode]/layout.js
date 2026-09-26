import { getVisitorAccess } from '@/lib/public/site'
import { SiteStatusRibbonHost } from '@/components/SiteStatusRibbon'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/**
 * /s/[siteCode] 공통 레이아웃
 * 쿠키에 따라 내용이 달라지므로 정적·공유 캐시 금지.
 * 사이트 조회는 getVisitorAccess(cache)로 page와 1회 공유.
 */
export default async function SiteCodeLayout({ children, params }) {
  const { siteCode } = await params
  const access = await getVisitorAccess(siteCode)

  return (
    <>
      {access.ok && access.visibility !== 'public' && (
        <SiteStatusRibbonHost
          status={access.site.status}
          visibility={access.visibility}
        />
      )}
      {children}
    </>
  )
}
