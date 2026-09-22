/**
 * 고객(방문자) 사이트 게시판 — 공개 페이지용 조회 (서버 컴포넌트)
 */

import { supabase } from '@/lib/supabase'
import { onlyActive } from '@/lib/use-flag'
import { getVisitorSiteBundle } from '@/lib/site-public'

/**
 * 사이트 번들 + 게시판
 * @returns {Promise<null | { site, visibility, board }>}
 */
export async function getBoardBundle(siteCode, boardKey) {
  const bundle = await getVisitorSiteBundle(siteCode)
  if (!bundle || bundle.visibility === 'hidden') return null

  const { data: board } = await onlyActive(
    supabase.from('user_boards').select('*')
      .eq('site_id', bundle.site.site_id)
      .eq('board_key', boardKey)
  ).maybeSingle()
  if (!board) return null

  return { site: bundle.site, visibility: bundle.visibility, board }
}

/** 목록 — 연락처 컬럼 제외 */
export async function getBoardPosts(board) {
  const { data } = await onlyActive(
    supabase.from('user_posts')
      .select('post_id, title, author, author_type, is_private, created_at, user_comments(author_type, use_flag)')
      .eq('user_board_id', board.user_board_id)
      .order('created_at', { ascending: false })
  )
  return data || []
}

/** 상세 — 연락처 컬럼 제외 · 댓글 포함 */
export async function getBoardPost(board, postId) {
  const { data: post } = await onlyActive(
    supabase.from('user_posts')
      .select('post_id, title, content, author, author_type, is_private, created_at')
      .eq('user_board_id', board.user_board_id)
      .eq('post_id', postId)
  ).maybeSingle()
  if (!post) return null

  const { data: comments } = await onlyActive(
    supabase.from('user_comments')
      .select('user_comment_id, author_type, author, content, created_at')
      .eq('post_id', postId)
      .order('created_at')
  )
  return { ...post, user_comments: comments || [] }
}
