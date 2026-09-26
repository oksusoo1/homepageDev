'use server'

import { getServerUser, findSiteByCode } from '@/lib/server/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { onlyActive } from '@/lib/use-flag'
import { boardMeta, POST_TITLE_MAX, POST_CONTENT_MAX } from '@/lib/user-board'
import { resolveSiteVisibility } from '@/lib/site-visibility'
import { redirect } from 'next/navigation'
import { boardPath } from '@/lib/site-paths'

function fail(error) {
  return { ok: false, error: error || '처리에 실패했습니다.' }
}

function clip(s, max) {
  const t = String(s ?? '').trim()
  return t.length > max ? t.slice(0, max) : t
}

export async function createPublicPostAction(prev, formData) {
  const siteCode = String(formData?.get?.('siteCode') || prev?.siteCode || '')
  const boardKey = String(formData?.get?.('boardKey') || prev?.boardKey || '')
  const input = formData?.get ? {
    name: formData.get('name'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    title: formData.get('title'),
    content: formData.get('content'),
    isPrivate: formData.get('isPrivate') === 'on',
  } : (prev || {})
  try {
    const db = createAdminClient()
    const site = await findSiteByCode(db, siteCode)
    if (!site) return fail('사이트를 찾을 수 없습니다.')

    const { data: board } = await onlyActive(
      db.from('user_boards').select('user_board_id, board_key, name, board_type').eq('site_id', site.site_id).eq('board_key', boardKey)
    ).maybeSingle()
    if (!board) return fail('게시판을 찾을 수 없습니다.')

    let user = null
    try { user = await getServerUser() } catch { user = null }

    let isStaff = false
    let customer = null
    if (user) {
      const { data: staff } = await db
        .from('staff')
        .select('staff_id')
        .eq('auth_id', user.id)
        .eq('status', 'active')
        .eq('use_flag', 1)
        .maybeSingle()
      isStaff = !!staff
      const { data: cust } = await onlyActive(
        db.from('customers').select('customer_id, name').eq('auth_id', user.id)
      ).maybeSingle()
      customer = cust
    }

    if (isStaff) return fail('본사는 글을 작성할 수 없습니다.')

    const meta = boardMeta(board)
    let authorType = 'user'
    let author = clip(input.name, 50)

    if (customer && customer.customer_id === site.customer_id) {
      authorType = 'owner'
      author = customer.name || '운영자'
    } else {
      if (!meta.userCanWrite) return fail('이 게시판은 운영자만 글을 쓸 수 있습니다.')
      if (resolveSiteVisibility(site).visibility !== 'public') {
        return fail('지금은 글을 남길 수 없습니다.')
      }
      if (!author) return fail('이름을 입력해 주세요')
      if (meta.needsContact && !clip(input.phone, 50) && !clip(input.email, 200)) {
        return fail('연락처(전화 또는 이메일)를 하나 이상 입력해 주세요')
      }
    }

    const title = clip(input.title, POST_TITLE_MAX)
    const content = clip(input.content, POST_CONTENT_MAX)
    if (!title) return fail('제목을 입력해 주세요')
    if (!content) return fail('내용을 입력해 주세요')

    const isPrivate = authorType === 'user' && meta.allowPrivate && !!input.isPrivate
    const row = {
      site_id: site.site_id,
      user_board_id: board.user_board_id,
      title,
      content,
      author,
      author_type: authorType,
      is_private: isPrivate,
      author_auth_id: authorType === 'user' && user?.id ? user.id : null,
      phone: authorType === 'owner' ? null : (clip(input.phone, 50) || null),
      email: authorType === 'owner' ? null : (clip(input.email, 200) || null),
    }
    const { error } = await db.from('user_posts').insert([row])
    if (error) return fail(error.message)
    const notice = isPrivate && !user ? '?notice=secret' : ''
    redirect(boardPath(siteCode, board.board_key) + notice)
  } catch (e) {
    if (e?.digest?.startsWith?.('NEXT_REDIRECT')) throw e
    return fail(e.message || '저장에 실패했습니다.')
  }
}
