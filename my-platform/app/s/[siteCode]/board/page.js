import { notFound, redirect } from 'next/navigation'
import { getVisitorAccess } from '@/lib/public/site'
import { boardPath } from '@/lib/site-paths'
import SiteGateScreen from '@/components/SiteGateScreen'

export const dynamic = 'force-dynamic'

/** /s/{code}/board → 첫 번째 게시판으로 */
export default async function BoardIndexPage({ params }) {
  const { siteCode } = await params
  const access = await getVisitorAccess(siteCode)
  if (access.notFound) notFound()
  if (!access.ok) {
    return <SiteGateScreen visibility={access.visibility} siteCode={siteCode} cancelled={access.cancelled} />
  }
  if (!access.boards.length) notFound()
  redirect(boardPath(siteCode, access.boards[0].board_key))
}
