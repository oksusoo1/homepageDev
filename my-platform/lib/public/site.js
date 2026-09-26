import 'server-only'
import { cache } from 'react'
import { unstable_noStore as noStore } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { onlyActive } from '@/lib/use-flag'
import { resolveSiteVisibility, canViewByVisibility } from '@/lib/site-visibility'
import { FLOW_STEPS } from '@/lib/flow-step'
import { getServerUser } from '@/lib/server/guard'

const SITE_LOAD_COLS = [
  'site_id', 'site_code', 'subdomain', 'name', 'description',
  'address', 'phone', 'email', 'content', 'status', 'build_type',
  'customer_id', 'inquiry_id',
].join(', ')

const BOARD_COLS = 'user_board_id, board_key, name, board_type, sort_order'

export function toPublicSite(row) {
  if (!row) return null
  return {
    site_id: row.site_id,
    site_code: row.site_code,
    subdomain: row.subdomain,
    name: row.name,
    description: row.description,
    address: row.address,
    phone: row.phone,
    email: row.email,
    content: row.content,
    status: row.status,
    build_type: row.build_type,
  }
}

export const getViewer = cache(async () => {
  noStore()
  const user = await getServerUser()
  if (!user) return { authId: null, isStaff: false, customerId: null, customerName: null }

  const db = createAdminClient()
  const [{ data: staff }, { data: customer }] = await Promise.all([
    db.from('staff').select('staff_id, name, email').eq('auth_id', user.id).eq('status', 'active').eq('use_flag', 1).maybeSingle(),
    onlyActive(db.from('customers').select('customer_id, name, email').eq('auth_id', user.id)).maybeSingle(),
  ])
  return {
    authId: user.id,
    isStaff: !!staff,
    staffName: staff?.name || null,
    staffEmail: staff?.email || user.email || null,
    customerId: customer?.customer_id || null,
    customerName: customer?.name || null,
    customerEmail: customer?.email || user.email || null,
  }
})

export function viewerAuthPreset(viewer, ownerCustomerId) {
  const isSiteOwner = !!(viewer?.customerId && ownerCustomerId && viewer.customerId === ownerCustomerId)
  if (!viewer?.authId) {
    return { preset: { status: 'guest', kind: null, name: '', email: '' }, isSiteOwner: false }
  }
  if (viewer.isStaff) {
    return {
      preset: { status: 'ok', kind: 'staff', name: viewer.staffName || '본사', email: viewer.staffEmail || '' },
      isSiteOwner,
    }
  }
  if (viewer.customerId) {
    return {
      preset: { status: 'ok', kind: 'customer', name: viewer.customerName || '회원', email: viewer.customerEmail || '' },
      isSiteOwner,
    }
  }
  return { preset: { status: 'guest', kind: null, name: '', email: '' }, isSiteOwner: false }
}

export const loadPublicSite = cache(async (siteCode) => {
  noStore()
  if (!siteCode) return null
  const db = createAdminClient()
  let { data, error } = await onlyActive(
    db.from('sites').select(SITE_LOAD_COLS).eq('subdomain', siteCode)
  ).maybeSingle()
  if (error) throw error
  if (!data) {
    ;({ data, error } = await onlyActive(
      db.from('sites').select(SITE_LOAD_COLS).eq('site_code', siteCode)
    ).maybeSingle())
    if (error) throw error
  }
  if (!data || !FLOW_STEPS.includes(data.status)) return null
  return data
})

export const loadPublicBoards = cache(async (siteId) => {
  if (!siteId) return []
  const db = createAdminClient()
  const { data, error } = await onlyActive(
    db.from('user_boards').select(BOARD_COLS).eq('site_id', siteId).order('sort_order')
  )
  if (error) throw error
  return data || []
})

async function resolveVisitorFlags(row) {
  const db = createAdminClient()
  const { data: sub } = await onlyActive(
    db.from('subscriptions').select('cancels_at, cancelled_at').eq('site_id', row.site_id)
  ).maybeSingle()

  if (sub?.cancels_at && new Date(sub.cancels_at) <= new Date() && !sub.cancelled_at) {
    return {
      visibility: 'hidden',
      cancelled: true,
      siteForVis: { ...row, status: 'suspended' },
    }
  }

  let finalPending = false
  if (
    row.inquiry_id
    && (row.status === 'preview' || row.status === 'balance')
  ) {
    const { data: inquiry } = await onlyActive(
      db.from('inquiries').select('inquiry_id, customer_id, final_paid_at').eq('inquiry_id', row.inquiry_id)
    ).maybeSingle()
    if (inquiry?.customer_id && !inquiry.final_paid_at) {
      const { data: otp } = await onlyActive(
        db.from('one_time_payments')
          .select('payment_id')
          .eq('customer_id', inquiry.customer_id)
          .eq('type', 'dev_fee')
          .eq('status', 'pending_confirm')
          .limit(1)
      )
      finalPending = !!(otp && otp.length)
    }
  }

  const { visibility } = resolveSiteVisibility(row, { finalPending })
  return {
    visibility,
    cancelled: !!(sub?.cancelled_at || (sub?.cancels_at && new Date(sub.cancels_at) <= new Date())),
    siteForVis: row,
  }
}

/** 방문자 접근 — 요청당 1회(cache). 비허용이면 본문·게시판을 조회하지 않는다 */
export const getVisitorAccess = cache(async (siteCode) => {
  noStore()
  const row = await loadPublicSite(siteCode)
  if (!row) {
    return { ok: false, notFound: true, visibility: 'hidden', cancelled: false, site: null, boards: [], viewer: null }
  }

  const viewer = await getViewer()
  const flags = await resolveVisitorFlags(row)
  const allowed = canViewByVisibility(flags.visibility, row.build_type, {
    isStaff: viewer.isStaff,
    isOwner: !!(viewer.customerId && viewer.customerId === row.customer_id),
  })

  if (!allowed) {
    return {
      ok: false,
      notFound: false,
      visibility: flags.visibility,
      cancelled: flags.cancelled,
      site: null,
      boards: [],
      viewer,
      customerId: row.customer_id,
      siteId: row.site_id,
    }
  }

  const boards = await loadPublicBoards(row.site_id)
  const bar = viewerAuthPreset(viewer, row.customer_id)
  return {
    ok: true,
    notFound: false,
    visibility: flags.visibility,
    cancelled: flags.cancelled,
    site: toPublicSite(flags.siteForVis),
    boards,
    viewer,
    authPreset: bar.preset,
    isSiteOwner: bar.isSiteOwner,
    customerId: row.customer_id,
    siteId: row.site_id,
  }
})
