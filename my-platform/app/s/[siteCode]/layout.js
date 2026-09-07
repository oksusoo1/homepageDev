import { getVisitorSite } from '@/lib/site-public'
import { SiteStatusRibbonHost } from '@/components/SiteStatusRibbon'

/**
 * /s/[siteCode] 공통 레이아웃
 * 방문자 페이지(홈/게시판/문의)에 상태 리본을 항상 표시
 * SiteStatusRibbonHost가 /admin 경로에서는 숨김
 */
export default async function SiteCodeLayout({ children, params }) {
  const { siteCode } = await params
  const site = await getVisitorSite(siteCode)

  return (
    <>
      {site && <SiteStatusRibbonHost status={site.status} />}
      {children}
    </>
  )
}
