/**
 * 고객(방문자) 사이트 게시판 — user_boards · user_posts · user_comments
 * board_type 이 동작을 결정 (설정 컬럼 없이 단순하게)
 *   notice  : 사장님만 작성
 *   qna     : 고객 작성 · 연락처 필수 · 비밀글 가능 · 사장님 답변 필요
 *   general : 고객 작성
 * author_type: owner = 사장님(customers) · user = 고객(방문자)
 */

import { onlyActive } from '@/lib/use-flag'

export const BOARD_TYPE_META = {
  notice: {
    label: '공지', icon: '📢', what: '나만 글을 씁니다', detail: '고객은 읽기만 합니다',
    userCanWrite: false, allowPrivate: false, needsReply: false, needsContact: false,
  },
  qna: {
    label: '문의', icon: '💬', what: '고객이 남기고 내가 답합니다', detail: '비밀글로 남길 수 있습니다',
    userCanWrite: true, allowPrivate: true, needsReply: true, needsContact: true,
  },
  general: {
    label: '자유', icon: '📝', what: '고객도 글을 씁니다', detail: '후기·자유 글에 쓰세요',
    userCanWrite: true, allowPrivate: false, needsReply: false, needsContact: false,
  },
}

export const POST_TITLE_MAX = 200
export const POST_CONTENT_MAX = 10000
export const COMMENT_MAX = 5000
export const BOARD_NAME_MAX = 80

export function boardMeta(board) {
  return BOARD_TYPE_META[board?.board_type] || BOARD_TYPE_META.general
}

/** 사장님 답변 여부 (comments: 해당 글의 활성 댓글) */
export function hasOwnerReply(comments) {
  return (comments || []).some(c => c.author_type === 'owner' && c.use_flag !== 0)
}

/** 답변 필요한 글인데 아직 사장님 댓글 없음 */
export function isUnanswered(post, board) {
  if (!boardMeta(board).needsReply || post.author_type !== 'user') return false
  return !hasOwnerReply(post.user_comments)
}

/** 공개 목록용 이름 마스킹: 홍길동 → 홍*동 */
export function maskName(name) {
  const s = String(name || '').trim()
  if (s.length <= 1) return s || '고객'
  if (s.length === 2) return s[0] + '*'
  return s[0] + '*'.repeat(s.length - 2) + s[s.length - 1]
}

/** 사이트 게시판 목록 (정렬순) */
export async function loadBoards(supabase, siteId) {
  const { data } = await onlyActive(
    supabase.from('user_boards').select('*').eq('site_id', siteId).order('sort_order')
  )
  return data || []
}

/**
 * 게시글 + 댓글 (사장님 관리자용)
 * @returns {Promise<object[]>} post.user_comments 포함
 */
export async function loadPostsWithComments(supabase, siteId) {
  const { data } = await onlyActive(
    supabase.from('user_posts')
      .select('*, user_comments(user_comment_id, author_type, author, content, use_flag, created_at)')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
  )
  return (data || []).map(p => ({
    ...p,
    user_comments: (p.user_comments || [])
      .filter(c => c.use_flag !== 0)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
  }))
}

/** 미답변 글 (boards 로 게시판 판별) */
export function unansweredPosts(posts, boards) {
  const byId = Object.fromEntries((boards || []).map(b => [b.user_board_id, b]))
  return (posts || []).filter(p => isUnanswered(p, byId[p.user_board_id]))
}

/**
 * 사이트별 답변 대기 글 수 (/my 사이트 카드용)
 * @returns {Promise<Record<string, number>>} { site_id: count }
 */
export async function countUnansweredBySite(supabase, siteIds) {
  if (!siteIds?.length) return {}
  const { data } = await onlyActive(
    supabase.from('user_posts')
      .select('site_id, user_boards!inner(board_type, use_flag), user_comments(author_type, use_flag)')
      .in('site_id', siteIds)
      .eq('author_type', 'user')
      .eq('user_boards.board_type', 'qna')
      .eq('user_boards.use_flag', 1)
  )
  const out = {}
  for (const p of data || []) {
    if (!hasOwnerReply(p.user_comments)) out[p.site_id] = (out[p.site_id] || 0) + 1
  }
  return out
}

/** 게시판 키: 영문 소문자·숫자·- 만 (사장님에게 노출하지 않음 — 자동 생성) */
export function normalizeBoardKey(raw) {
  return String(raw || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
}

/**
 * 새 게시판 주소 자동 생성 — 사장님은 이름만 입력
 * 종류별 기본 키(notice/qna/board)에 중복이면 숫자를 붙인다
 */
export function makeBoardKey(boardType, existingBoards = []) {
  const base = boardType === 'notice' ? 'notice' : boardType === 'qna' ? 'qna' : 'board'
  const used = new Set(existingBoards.map(b => b.board_key))
  if (!used.has(base)) return base
  for (let i = 2; i < 100; i++) {
    if (!used.has(base + i)) return base + i
  }
  return base + Date.now()
}
