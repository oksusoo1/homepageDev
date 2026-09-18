import { getVisitorSiteBundle } from '@/lib/site-public'
import { SiteStatusRibbonHost } from '@/components/SiteStatusRibbon'

/**
 * /s/[siteCode] 공통 레이아웃
 * 방문자 페이지에 공개 범위 리본 표시 (/admin 제외)
 */
export default async function SiteCodeLayout({ children, params }) {
  const { siteCode } = await params
  const bundle = await getVisitorSiteBundle(siteCode)

  return (
    <>
      {bundle && (
        <SiteStatusRibbonHost
          status={bundle.site.status}
          visibility={bundle.visibility === 'public' ? null : bundle.visibility}
        />
      )}
      {children}
    </>
  )
}
