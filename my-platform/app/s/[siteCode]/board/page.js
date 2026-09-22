import { notFound, redirect } from 'next/navigation'
import { getSiteByCode } from '@/lib/site-public'
import { boardPath } from '@/lib/site-paths'
import { supabase } from '@/lib/supabase'
import { loadBoards } from '@/lib/user-board'

/** /s/{code}/board → 첫 번째 게시판으로 */
export default async function BoardIndexPage({ params }) {
  const { siteCode } = await params
  const site = await getSiteByCode(siteCode)
  if (!site) notFound()

  const boards = await loadBoards(supabase, site.site_id)
  if (!boards.length) notFound()

  redirect(boardPath(siteCode, boards[0].board_key))
}
