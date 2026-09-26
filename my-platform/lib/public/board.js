import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { onlyActive } from '@/lib/use-flag'
import { hasOwnerReply } from '@/lib/user-board'

const POST_LIST_COLS = 'post_id, title, author, author_type, is_private, author_auth_id, created_at'
const POST_LIST_COLS_FALLBACK = 'post_id, title, author, author_type, is_private, created_at'
const POST_DETAIL_COLS = 'post_id, title, content, author, author_type, is_private, author_auth_id, created_at'
const POST_DETAIL_COLS_FALLBACK = 'post_id, title, content, author, author_type, is_private, created_at'
const COMMENT_COLS = 'user_comment_id, author_type, author, content, created_at'

function missingAuthCol(error) {
  return !!error && /author_auth_id/.test(error.message || '')
}

export function canReadSecretPost(post, viewer, ownerCustomerId) {
  if (!post?.is_private) return true
  if (viewer?.customerId && ownerCustomerId && viewer.customerId === ownerCustomerId) return true
  if (post.author_auth_id && viewer?.authId && post.author_auth_id === viewer.authId) return true
  return false
}

export function presentPostListItem(post, viewer, ownerCustomerId) {
  const comments = post.user_comments || []
  const answered = hasOwnerReply(comments)
  const canRead = canReadSecretPost(post, viewer, ownerCustomerId)
  const base = {
    post_id: post.post_id,
    author: post.author,
    author_type: post.author_type,
    is_private: !!post.is_private,
    created_at: post.created_at,
    canRead,
    answered,
  }
  if (canRead) {
    return { ...base, title: post.title }
  }
  return { ...base, title: '비밀글입니다' }
}

export function presentPostDetail(post, comments, viewer, ownerCustomerId) {
  const canRead = canReadSecretPost(post, viewer, ownerCustomerId)
  const answered = hasOwnerReply(comments)
  const base = {
    post_id: post.post_id,
    author: post.author,
    author_type: post.author_type,
    is_private: !!post.is_private,
    created_at: post.created_at,
    canRead,
    answered,
  }
  if (canRead) {
    return {
      ...base,
      title: post.title,
      content: post.content,
      user_comments: comments || [],
    }
  }
  return {
    ...base,
    title: '비밀글입니다',
    content: null,
    user_comments: [],
  }
}

export async function loadPublicBoard(siteId, boardKey) {
  const db = createAdminClient()
  const { data } = await onlyActive(
    db.from('user_boards')
      .select('user_board_id, board_key, name, board_type, sort_order')
      .eq('site_id', siteId)
      .eq('board_key', boardKey)
  ).maybeSingle()
  return data || null
}

export async function loadPublicPosts(board, viewer, ownerCustomerId) {
  const db = createAdminClient()
  let q = await onlyActive(
    db.from('user_posts')
      .select(`${POST_LIST_COLS}, user_comments(author_type, use_flag)`)
      .eq('user_board_id', board.user_board_id)
      .order('created_at', { ascending: false })
  )
  if (missingAuthCol(q.error)) {
    q = await onlyActive(
      db.from('user_posts')
        .select(`${POST_LIST_COLS_FALLBACK}, user_comments(author_type, use_flag)`)
        .eq('user_board_id', board.user_board_id)
        .order('created_at', { ascending: false })
    )
  }
  if (q.error) throw q.error
  return (q.data || []).map(p => presentPostListItem(p, viewer, ownerCustomerId))
}

export async function loadPublicPost(board, postId, viewer, ownerCustomerId) {
  const db = createAdminClient()
  let postRes = await onlyActive(
    db.from('user_posts')
      .select(POST_DETAIL_COLS)
      .eq('user_board_id', board.user_board_id)
      .eq('post_id', postId)
  ).maybeSingle()
  if (missingAuthCol(postRes.error)) {
    postRes = await onlyActive(
      db.from('user_posts')
        .select(POST_DETAIL_COLS_FALLBACK)
        .eq('user_board_id', board.user_board_id)
        .eq('post_id', postId)
    ).maybeSingle()
  }
  if (postRes.error) throw postRes.error
  const post = postRes.data
  if (!post) return null

  const canRead = canReadSecretPost(post, viewer, ownerCustomerId)
  let comments = []
  if (canRead) {
    const { data } = await onlyActive(
      db.from('user_comments')
        .select(COMMENT_COLS)
        .eq('post_id', postId)
        .order('created_at')
    )
    comments = data || []
  } else {
    const { data } = await onlyActive(
      db.from('user_comments')
        .select('author_type, use_flag')
        .eq('post_id', postId)
    )
    comments = data || []
  }
  return presentPostDetail(post, comments, viewer, ownerCustomerId)
}

export async function loadRecentPublicNotices(noticeBoard) {
  if (!noticeBoard) return []
  const db = createAdminClient()
  const { data } = await onlyActive(
    db.from('user_posts')
      .select('post_id, title, author, created_at')
      .eq('user_board_id', noticeBoard.user_board_id)
      .eq('is_private', false)
      .order('created_at', { ascending: false })
      .limit(3)
  )
  return data || []
}
