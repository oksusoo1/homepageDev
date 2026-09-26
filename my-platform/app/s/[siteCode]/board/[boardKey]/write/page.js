import { notFound } from 'next/navigation'
import { getVisitorAccess } from '@/lib/public/site'
import { loadPublicBoard } from '@/lib/public/board'
import { boardMeta } from '@/lib/user-board'
import SiteGateScreen from '@/components/SiteGateScreen'
import SitePublicFrame from '@/components/SitePublicFrame'
import WritePostForm from '@/components/WritePostForm'

export const dynamic = 'force-dynamic'

export default async function WritePostPage({ params }) {
  const { siteCode, boardKey } = await params
  const access = await getVisitorAccess(siteCode)
  if (access.notFound) notFound()
  if (!access.ok) {
    return <SiteGateScreen visibility={access.visibility} siteCode={siteCode} cancelled={access.cancelled} />
  }

  const board = await loadPublicBoard(access.siteId, boardKey)
  if (!board) notFound()

  const viewer = access.viewer
  let mode = 'user'
  let denyReason = 'login'
  if (viewer.isStaff) {
    mode = 'deny'
    denyReason = 'staff'
  } else if (viewer.customerId && viewer.customerId === access.customerId) {
    mode = 'owner'
  } else if (boardMeta(board).userCanWrite) {
    mode = 'user'
  } else {
    mode = 'deny'
    denyReason = viewer.customerId ? 'other_customer' : 'login'
  }

  return (
    <SitePublicFrame
      site={access.site}
      siteCode={siteCode}
      boards={access.boards}
      activePage={board.board_key}
      maxWidth={mode === 'deny' ? 480 : 720}
      authPreset={access.authPreset}
      isSiteOwner={access.isSiteOwner}
    >
      <WritePostForm
        siteCode={siteCode}
        board={board}
        mode={mode}
        denyReason={denyReason}
        ownerName={viewer.customerName}
      />
    </SitePublicFrame>
  )
}
