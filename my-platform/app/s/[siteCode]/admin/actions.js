'use server'

import { requireOwnedSiteByCode, requireStaff, findSiteByCode } from '@/lib/server/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { onlyActive } from '@/lib/use-flag'
import { softDelete } from '@/lib/use-flag-write'
import { deploySite } from '@/lib/deploy'
import { getBillingReadiness, assertPaymentSetupAllowed } from '@/lib/billing'
import { registerBankTransfer } from '@/lib/billing-write'
import { pickSiteOwnerPatch } from '@/lib/site-edit'
import { addTicketMessage, markTicketMessagesRead } from '@/lib/support-ticket-write'
import { canCustomerEditTicket } from '@/lib/support-ticket'
import { cancelQuote, payQuoteCardMock, requestQuoteBankTransfer } from '@/lib/payment/extra-write'
import { loadQuote } from '@/lib/payment/extra'
import {
  BOARD_TYPE_META, makeBoardKey,
  POST_TITLE_MAX, POST_CONTENT_MAX, COMMENT_MAX, BOARD_NAME_MAX,
} from '@/lib/user-board'
import {
  isResubscribeCharge,
  normalizeCardLast4,
  replaceCustomerCard,
  applyCardResubscribe,
} from '@/lib/payment/card-policy'

function ok(data) {
  return { ok: true, data }
}

function fail(error) {
  return { ok: false, error: error || '처리에 실패했습니다.' }
}

async function loadBillingContext(db, site) {
  const [{ data: card }, { data: sub }, inquiry] = await Promise.all([
    onlyActive(
      db.from('customer_payment_methods')
        .select('payment_method_id, card_name, card_last4')
        .eq('customer_id', site.customer_id)
    ).maybeSingle(),
    onlyActive(
      db.from('subscriptions').select('*').eq('site_id', site.site_id)
    ).maybeSingle(),
    site.inquiry_id
      ? onlyActive(
          db.from('inquiries').select('*').eq('inquiry_id', site.inquiry_id)
        ).maybeSingle().then(r => r.data)
      : Promise.resolve(null),
  ])
  return { card: card || null, sub: sub || null, inquiry }
}

function canDeployStatus(site, inquiry) {
  if (site.build_type === 'self') {
    return ['building', 'pay_method'].includes(site.status)
  }
  return site.status === 'pay_method' && !!inquiry?.final_paid_at
}

async function runDeploy(db, { site, customerId }) {
  const { card, sub } = await loadBillingContext(db, site)
  const billing = getBillingReadiness(card, sub, site)
  if (!billing.ready) {
    return ok({ requireBillingSetup: true, trialEndsAt: null, siteStatus: site.status })
  }

  const result = await deploySite(db, {
    site,
    customerId,
    billingMethod: billing.method,
  })
  if (result.error) return fail(result.error)

  const { data: subscription } = await onlyActive(
    db.from('subscriptions').select('*').eq('site_id', site.site_id)
  ).maybeSingle()

  return ok({
    requireBillingSetup: !!result.requireBillingSetup,
    trialEndsAt: result.trialEndsAt,
    siteStatus: result.requireBillingSetup ? 'pay_method' : 'trial',
    card,
    subscription,
  })
}

/** 서비스 시작 */
export async function deploySiteAction(siteCode) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)

  const { db, site, customer } = gate
  const { inquiry } = await loadBillingContext(db, site)
  if (!canDeployStatus(site, inquiry)) {
    return fail('지금은 서비스를 시작할 수 없습니다.')
  }

  return runDeploy(db, { site, customerId: customer.customer_id })
}

/**
 * 카드 목업 등록. 서버에는 끝 4자리만.
 * 즉시 결제는 재구독(해지·정지)일 때만.
 */
export async function registerCardMockAction(siteCode, { cardLast4, alsoDeploy = false } = {}) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)

  const last4 = normalizeCardLast4(cardLast4)
  if (last4.length !== 4) return fail('카드 끝 4자리가 필요합니다.')

  const { db, site, customer } = gate
  const setup = await assertPaymentSetupAllowed(db, site.site_id)
  const { card, sub, inquiry } = await loadBillingContext(db, site)
  const resubscribe = isResubscribeCharge(site, sub)

  if (!setup.ok && !resubscribe) return fail(setup.error)
  if (site.build_type === 'managed' && !inquiry?.final_paid_at) {
    return fail('잔금 확인 후 결제 수단을 등록할 수 있습니다.')
  }

  const now = new Date()
  const billingKey = `MOCK_BILLING_${customer.customer_id}_${Date.now()}`

  try {
    await replaceCustomerCard(db, customer.customer_id, { billingKey, last4 })
  } catch (e) {
    return fail(e.message)
  }

  let charged = false
  if (resubscribe && sub) {
    try {
      await applyCardResubscribe(db, {
        site,
        sub,
        now,
        note: '[MOCK] 재구독 즉시 결제',
      })
      charged = true
    } catch (e) {
      return fail(e.message)
    }
  } else if (sub) {
    await db.from('subscriptions').update({
      payment_method: 'card',
      updated_at: now.toISOString(),
    }).eq('site_id', site.site_id)
  }

  if (alsoDeploy && !charged) {
    const fresh = await onlyActive(
      db.from('sites').select('*').eq('site_id', site.site_id)
    ).maybeSingle()
    const deploy = await runDeploy(db, {
      site: fresh.data || site,
      customerId: customer.customer_id,
    })
    if (!deploy.ok) return deploy
    return ok({ ...deploy.data, charged, cardLast4: last4, hadCard: !!card })
  }

  return ok({ charged, cardLast4: last4, requireBillingSetup: false })
}

/** 계좌이체 구독 등록 */
export async function registerBankTransferAction(siteCode, { depositorName, alsoDeploy = false } = {}) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)

  const { db, site, customer } = gate
  const reg = await registerBankTransfer(db, {
    siteId: site.site_id,
    depositorName,
  })
  if (reg.error) return fail(reg.error)

  if (alsoDeploy) {
    const { data: fresh } = await onlyActive(
      db.from('sites').select('*').eq('site_id', site.site_id)
    ).maybeSingle()
    return runDeploy(db, { site: fresh || site, customerId: customer.customer_id })
  }

  return ok({ requireBillingSetup: false })
}

/** 구독 해지 예약 — trial/subscribed만 */
export async function cancelSubscriptionAction(siteCode) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)

  const { db, site } = gate
  if (!['trial', 'subscribed'].includes(site.status)) {
    return fail('체험·구독 중에서만 해지할 수 있습니다.')
  }

  const { data: sub } = await onlyActive(
    db.from('subscriptions').select('*').eq('site_id', site.site_id)
  ).maybeSingle()
  if (!sub) return fail('구독 정보가 없습니다.')
  if (sub.cancelled_at || sub.cancels_at) return fail('이미 해지되었거나 해지 예약된 구독입니다.')

  const now = new Date().toISOString()
  const patch = {
    cancelled_at: now,
    cancels_at: sub.next_billing_date,
    next_billing_date: null,
  }
  const { error } = await db.from('subscriptions')
    .update(patch)
    .eq('subscription_id', sub.subscription_id)
  if (error) return fail(error.message)

  return ok({ ...sub, ...patch })
}

/** 해지 예약 철회 */
export async function reinstateSubscriptionAction(siteCode) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)

  const { db, site } = gate
  const { data: sub } = await onlyActive(
    db.from('subscriptions').select('*').eq('site_id', site.site_id)
  ).maybeSingle()
  if (!sub) return fail('구독 정보가 없습니다.')
  if (!sub.cancels_at) return fail('해지 예약이 없습니다.')

  const { error } = await db.from('subscriptions').update({
    cancelled_at: null,
    cancels_at: null,
  }).eq('subscription_id', sub.subscription_id)
  if (error) return fail(error.message)

  return ok({ ...sub, cancelled_at: null, cancels_at: null })
}

function clip(s, max) {
  const t = String(s ?? '').trim()
  return t.length > max ? t.slice(0, max) : t
}

async function saveOwnedSitePatch(db, site, input) {
  const picked = pickSiteOwnerPatch(input)
  if (!picked.ok) return fail(picked.error)
  const { error } = await db.from('sites')
    .update({ ...picked.patch, updated_at: new Date().toISOString() })
    .eq('site_id', site.site_id)
    .eq('use_flag', 1)
  if (error) return fail(error.message)
  return ok({ patch: picked.patch })
}

/** 에디터·사이트정보 — 허용 목록만. 사장님 또는 본사 */
export async function saveSiteOwnerPatchAction(siteCode, input = {}) {
  const owner = await requireOwnedSiteByCode(siteCode)
  if (owner.ok) return saveOwnedSitePatch(owner.db, owner.site, input)

  const staff = await requireStaff()
  if (!staff.ok) return fail(owner.error)
  const db = createAdminClient()
  const site = await findSiteByCode(db, siteCode)
  if (!site) return fail('사이트를 찾을 수 없습니다.')
  return saveOwnedSitePatch(db, site, input)
}

async function requireOwnedBoard(siteCode, boardId) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return gate
  const { data: board } = await onlyActive(
    gate.db.from('user_boards').select('*').eq('user_board_id', boardId).eq('site_id', gate.site.site_id)
  ).maybeSingle()
  if (!board) return { ok: false, error: '게시판을 찾을 수 없습니다.' }
  return { ...gate, board }
}

async function requireOwnedPost(siteCode, postId) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return gate
  const { data: post } = await onlyActive(
    gate.db.from('user_posts').select('*').eq('post_id', postId).eq('site_id', gate.site.site_id)
  ).maybeSingle()
  if (!post) return { ok: false, error: '글을 찾을 수 없습니다.' }
  return { ...gate, post }
}

export async function createBoardAction(siteCode, { name, boardType } = {}) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)
  const title = clip(name, BOARD_NAME_MAX)
  if (!title) return fail('게시판 이름을 적어 주세요')
  const type = BOARD_TYPE_META[boardType] ? boardType : 'general'
  const { data: boards } = await onlyActive(
    gate.db.from('user_boards').select('board_key, sort_order').eq('site_id', gate.site.site_id)
  )
  const { error } = await gate.db.from('user_boards').insert({
    site_id: gate.site.site_id,
    name: title,
    board_key: makeBoardKey(type, boards || []),
    board_type: type,
    sort_order: Math.max(0, ...(boards || []).map(b => b.sort_order || 0)) + 1,
  })
  if (error) return fail(error.message)
  return ok(null)
}

export async function renameBoardAction(siteCode, boardId, { name } = {}) {
  const gate = await requireOwnedBoard(siteCode, boardId)
  if (!gate.ok) return fail(gate.error)
  const title = clip(name, BOARD_NAME_MAX)
  if (!title) return fail('이름을 적어 주세요')
  const { error } = await gate.db.from('user_boards')
    .update({ name: title, updated_at: new Date().toISOString() })
    .eq('user_board_id', gate.board.user_board_id)
  if (error) return fail(error.message)
  return ok(null)
}

export async function moveBoardAction(siteCode, boardId, direction) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)
  const { data: boards } = await onlyActive(
    gate.db.from('user_boards').select('user_board_id, sort_order')
      .eq('site_id', gate.site.site_id)
      .order('sort_order')
  )
  const list = boards || []
  const idx = list.findIndex(b => b.user_board_id === boardId)
  const other = list[idx + direction]
  if (idx < 0 || !other) return fail('순서를 바꿀 수 없습니다.')
  const now = new Date().toISOString()
  const a = await gate.db.from('user_boards')
    .update({ sort_order: other.sort_order, updated_at: now })
    .eq('user_board_id', list[idx].user_board_id)
  const b = await gate.db.from('user_boards')
    .update({ sort_order: list[idx].sort_order, updated_at: now })
    .eq('user_board_id', other.user_board_id)
  if (a.error || b.error) return fail((a.error || b.error).message)
  return ok(null)
}

export async function deleteBoardAction(siteCode, boardId) {
  const gate = await requireOwnedBoard(siteCode, boardId)
  if (!gate.ok) return fail(gate.error)
  try {
    await softDelete(gate.db, 'user_boards', 'user_board_id', gate.board.user_board_id)
  } catch (e) {
    return fail(e.message)
  }
  return ok(null)
}

export async function createOwnerPostAction(siteCode, { boardId, title, content } = {}) {
  const gate = await requireOwnedBoard(siteCode, boardId)
  if (!gate.ok) return fail(gate.error)
  const t = clip(title, POST_TITLE_MAX)
  const c = clip(content, POST_CONTENT_MAX)
  if (!t) return fail('제목을 입력해 주세요')
  if (!c) return fail('내용을 입력해 주세요')
  const { error } = await gate.db.from('user_posts').insert({
    site_id: gate.site.site_id,
    user_board_id: gate.board.user_board_id,
    title: t,
    content: c,
    author: gate.customer.name || '운영자',
    author_type: 'owner',
  })
  if (error) return fail(error.message)
  return ok(null)
}

export async function deleteOwnerPostAction(siteCode, postId) {
  const gate = await requireOwnedPost(siteCode, postId)
  if (!gate.ok) return fail(gate.error)
  try {
    await softDelete(gate.db, 'user_posts', 'post_id', gate.post.post_id)
  } catch (e) {
    return fail(e.message)
  }
  return ok(null)
}

export async function addOwnerCommentAction(siteCode, postId, content) {
  const gate = await requireOwnedPost(siteCode, postId)
  if (!gate.ok) return fail(gate.error)
  const text = clip(content, COMMENT_MAX)
  if (!text) return fail('답변 내용을 입력해 주세요')
  const { error } = await gate.db.from('user_comments').insert({
    post_id: gate.post.post_id,
    author_type: 'owner',
    author: gate.customer.name || '운영자',
    content: text,
  })
  if (error) return fail(error.message)
  return ok(null)
}

export async function deleteOwnerCommentAction(siteCode, commentId) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)
  const { data: comment } = await onlyActive(
    gate.db.from('user_comments').select('user_comment_id, post_id').eq('user_comment_id', commentId)
  ).maybeSingle()
  if (!comment) return fail('댓글을 찾을 수 없습니다.')
  const { data: post } = await onlyActive(
    gate.db.from('user_posts').select('post_id').eq('post_id', comment.post_id).eq('site_id', gate.site.site_id)
  ).maybeSingle()
  if (!post) return fail('권한이 없습니다.')
  try {
    await softDelete(gate.db, 'user_comments', 'user_comment_id', comment.user_comment_id)
  } catch (e) {
    return fail(e.message)
  }
  return ok(null)
}

const TICKET_CATEGORIES = new Set(['text_change', 'image', 'page_add', 'feature', 'etc'])

async function requireOwnedTicket(siteCode, ticketId) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return gate
  const { data: ticket } = await onlyActive(
    gate.db.from('support_tickets').select('*')
      .eq('ticket_id', ticketId)
      .eq('site_id', gate.site.site_id)
      .eq('customer_id', gate.customer.customer_id)
  ).maybeSingle()
  if (!ticket) return { ok: false, error: '요청을 찾을 수 없습니다.' }
  return { ...gate, ticket }
}

export async function createSupportTicketAction(siteCode, { title, content, category } = {}) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)
  const t = clip(title, 200)
  const c = clip(content, 5000)
  if (!t || !c) return fail('제목과 내용을 입력해 주세요.')
  const cat = TICKET_CATEGORIES.has(category) ? category : 'etc'
  const { error } = await gate.db.from('support_tickets').insert([{
    site_id: gate.site.site_id,
    customer_id: gate.customer.customer_id,
    title: t,
    content: c,
    category: cat,
    status: 'open',
    priority: 'normal',
    deadline_days: 3,
    deadline_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  }])
  if (error) return fail(error.message)
  return ok(null)
}

export async function updateSupportTicketAction(siteCode, ticketId, { title, content } = {}) {
  const gate = await requireOwnedTicket(siteCode, ticketId)
  if (!gate.ok) return fail(gate.error)
  if (!canCustomerEditTicket(gate.ticket)) return fail('접수한 요청만 수정할 수 있습니다.')
  const t = clip(title, 200)
  const c = clip(content, 5000)
  if (!t || !c) return fail('제목과 내용을 입력해 주세요.')
  const { error } = await gate.db.from('support_tickets')
    .update({ title: t, content: c, updated_at: new Date().toISOString() })
    .eq('ticket_id', gate.ticket.ticket_id)
  if (error) return fail(error.message)
  return ok(null)
}

export async function cancelSupportTicketAction(siteCode, ticketId) {
  const gate = await requireOwnedTicket(siteCode, ticketId)
  if (!gate.ok) return fail(gate.error)
  if (!canCustomerEditTicket(gate.ticket)) return fail('접수한 요청만 취소할 수 있습니다.')
  try {
    await softDelete(gate.db, 'support_tickets', 'ticket_id', gate.ticket.ticket_id)
  } catch (e) {
    return fail(e.message)
  }
  return ok(null)
}

export async function addCustomerTicketMessageAction(siteCode, ticketId, content) {
  const gate = await requireOwnedTicket(siteCode, ticketId)
  if (!gate.ok) return fail(gate.error)
  try {
    await addTicketMessage(gate.db, {
      ticketId: gate.ticket.ticket_id,
      authorType: 'customer',
      author: gate.customer.name || '사장님',
      content,
    })
  } catch (e) {
    return fail(e.message)
  }
  return ok(null)
}

export async function markCustomerTicketsReadAction(siteCode, ticketIds) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)
  const ids = Array.isArray(ticketIds) ? ticketIds.filter(Boolean) : []
  if (!ids.length) return ok({ changed: false })
  const { data: owned } = await onlyActive(
    gate.db.from('support_tickets').select('ticket_id')
      .eq('site_id', gate.site.site_id)
      .eq('customer_id', gate.customer.customer_id)
      .in('ticket_id', ids)
  )
  const mine = (owned || []).map(t => t.ticket_id)
  const changed = await markTicketMessagesRead(gate.db, mine, 'customer')
  return ok({ changed })
}

export async function rejectQuoteAction(siteCode, ticketId, paymentId) {
  const gate = await requireOwnedTicket(siteCode, ticketId)
  if (!gate.ok) return fail(gate.error)
  const { data: quote } = await onlyActive(
    gate.db.from('one_time_payments').select('payment_id, ticket_id, customer_id')
      .eq('payment_id', paymentId)
      .eq('ticket_id', gate.ticket.ticket_id)
      .eq('customer_id', gate.customer.customer_id)
      .eq('type', 'extra')
  ).maybeSingle()
  if (!quote) return fail('견적을 찾을 수 없습니다.')
  try {
    await cancelQuote(gate.db, quote.payment_id)
    await addTicketMessage(gate.db, {
      ticketId: gate.ticket.ticket_id,
      authorType: 'customer',
      author: gate.customer.name || '사장님',
      content: '보내주신 견적은 진행하지 않겠습니다.',
    })
  } catch (e) {
    return fail(e.message)
  }
  return ok(null)
}

export async function payQuoteCardMockAction(siteCode, paymentId) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)
  const check = await loadQuote(gate.db, paymentId, gate.customer.customer_id)
  if (!check.ok) return fail(check.error)
  if (check.quote.site_id && check.quote.site_id !== gate.site.site_id) {
    return fail('권한이 없습니다.')
  }
  const result = await payQuoteCardMock(gate.db, { quote: check.quote })
  if (result.error) return fail(result.error)
  return ok(null)
}

export async function requestQuoteBankTransferAction(siteCode, paymentId, { depositorName } = {}) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)
  const check = await loadQuote(gate.db, paymentId, gate.customer.customer_id)
  if (!check.ok) return fail(check.error)
  if (check.quote.site_id && check.quote.site_id !== gate.site.site_id) {
    return fail('권한이 없습니다.')
  }
  const result = await requestQuoteBankTransfer(gate.db, { quote: check.quote, depositorName })
  if (result.error) return fail(result.error)
  return ok(null)
}
