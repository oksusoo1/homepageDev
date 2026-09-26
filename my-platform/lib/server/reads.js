import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { onlyActive } from '@/lib/use-flag'
import {
  getServerUser,
  requireCustomer,
  requireOwnedSiteByCode,
  requireOwnedInquiry,
  requireStaff,
  findSiteByCode,
} from '@/lib/server/guard'
import { assertPaymentSetupAllowed } from '@/lib/billing'
import { loadBoards, loadPostsWithComments, countUnansweredBySite } from '@/lib/user-board'
import { loadCustomerTicketMessages } from '@/lib/support-ticket'
import { loadTicketQuotes, loadQuote } from '@/lib/payment/extra'
import { loadDevFeePayments, loadInquiryForPayment } from '@/lib/payment/one-time'

function ok(data) {
  return { ok: true, data }
}

function fail(error) {
  return { ok: false, error: error || '조회에 실패했습니다.' }
}

const CUSTOMER_COLS = 'customer_id, auth_id, email, name, phone, status, withdraw_at'
const SITE_MY_COLS = 'site_id, site_code, subdomain, name, status, build_type, inquiry_id, customer_id, created_at, templates(name, category), subscriptions(amount, next_billing_date, cancelled_at, cancels_at)'
const SITE_ADMIN_COLS = 'site_id, site_code, subdomain, name, description, address, phone, email, content, status, build_type, inquiry_id, customer_id, trial_started_at, trial_ends_at, created_at, templates(name, category)'
const SITE_EDITOR_COLS = 'site_id, site_code, subdomain, name, description, address, phone, email, content, status, build_type, inquiry_id, customer_id'
const SITE_PAY_COLS = 'site_id, site_code, subdomain, name, status, build_type, inquiry_id, customer_id, content'
const INQUIRY_COLS = 'inquiry_id, customer_id, business_type, description, phone, dev_fee_total, down_paid_at, final_paid_at, created_at'
const SUB_COLS = 'subscription_id, site_id, customer_id, amount, payment_method, next_billing_date, cancelled_at, cancels_at, depositor_name, bank_transfer_agreed_at'
const PM_COLS = 'payment_method_id, customer_id, card_last4, pg_customer_id, created_at'
const BH_COLS = 'billing_id, subscription_id, period, amount, status, created_at'
const TICKET_COLS = 'ticket_id, site_id, customer_id, title, content, category, status, created_at, deadline_at, deadline_days'
const TPL_COLS = 'template_id, name, category, thumbnail_url, sort_order'

export async function loadAuthBar(siteCode = '') {
  const user = await getServerUser()
  if (!user) return ok({ preset: { status: 'guest', kind: null, name: '', email: '' }, isSiteOwner: false })

  const db = createAdminClient()
  const { data: staff } = await db
    .from('staff')
    .select('name, email, role')
    .eq('auth_id', user.id)
    .eq('status', 'active')
    .eq('use_flag', 1)
    .maybeSingle()
  if (staff?.role === 'platform_admin') {
    return ok({
      preset: { status: 'ok', kind: 'staff', name: staff.name || '본사', email: staff.email || user.email || '' },
      isSiteOwner: false,
    })
  }

  const { data: customer } = await onlyActive(
    db.from('customers').select('customer_id, name, email').eq('auth_id', user.id)
  ).maybeSingle()
  if (!customer) {
    return ok({ preset: { status: 'guest', kind: null, name: '', email: '' }, isSiteOwner: false })
  }

  let isSiteOwner = false
  if (siteCode) {
    const site = await findSiteByCode(db, siteCode)
    isSiteOwner = site?.customer_id === customer.customer_id
  }
  return ok({
    preset: {
      status: 'ok',
      kind: 'customer',
      name: customer.name || '회원',
      email: customer.email || user.email || '',
    },
    isSiteOwner,
  })
}

export async function resolvePostLoginPath() {
  const user = await getServerUser()
  if (!user) return ok({ path: null })
  const db = createAdminClient()
  const { data: staff } = await onlyActive(
    db.from('staff').select('role').eq('auth_id', user.id).eq('status', 'active')
  ).maybeSingle()
  if (staff?.role === 'platform_admin') return ok({ path: '/platform' })
  const { data: customer } = await onlyActive(
    db.from('customers').select('customer_id').eq('auth_id', user.id)
  ).maybeSingle()
  return ok({ path: customer ? '/my' : null })
}

export async function loadCommonCodesRows() {
  const user = await getServerUser()
  if (!user) return fail('로그인이 필요합니다.')
  const db = createAdminClient()
  const { data, error } = await onlyActive(
    db.from('common_codes').select('group_code, code, label, sort_order, use_flag').order('group_code').order('sort_order')
  )
  if (error) return fail(error.message)
  return ok({ codes: data || [] })
}

export async function loadMyHome() {
  const gate = await requireCustomer()
  if (!gate.ok) return fail(gate.error)
  const { db, customer } = gate
  const cust = {
    customer_id: customer.customer_id,
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    status: customer.status,
    withdraw_at: customer.withdraw_at,
  }
  if (customer.status === 'withdrawn') {
    return ok({ customer: cust, withdrawn: true, sites: [], inquiries: [], linkedSiteMap: {}, pendingOtps: [], waitingBySite: {} })
  }

  const { data: sites, error: sitesErr } = await onlyActive(
    db.from('sites').select(SITE_MY_COLS).eq('customer_id', customer.customer_id)
  ).order('created_at', { ascending: false })
  if (sitesErr) return fail(sitesErr.message)
  const siteList = (sites || []).map(s => ({
    ...s,
    subscriptions: Array.isArray(s.subscriptions)
      ? s.subscriptions
      : (s.subscriptions ? [s.subscriptions] : []),
  }))

  const { data: inquiries, error: inqErr } = await onlyActive(
    db.from('inquiries').select(INQUIRY_COLS).eq('customer_id', customer.customer_id)
  ).order('created_at', { ascending: false })
  if (inqErr) return fail(inqErr.message)
  const inqList = inquiries || []

  const linkedSiteMap = {}
  for (const s of siteList) {
    if (s.inquiry_id) {
      linkedSiteMap[s.inquiry_id] = {
        site_id: s.site_id,
        subdomain: s.subdomain,
        status: s.status,
        inquiry_id: s.inquiry_id,
      }
    }
  }

  const pendingOtps = await loadDevFeePayments(db, customer.customer_id)
  const waitingBySite = await countUnansweredBySite(db, siteList.map(s => s.site_id))
  return ok({
    customer: cust,
    withdrawn: false,
    sites: siteList,
    inquiries: inqList,
    linkedSiteMap,
    pendingOtps,
    waitingBySite,
  })
}

export async function loadCustomerSelf() {
  const gate = await requireCustomer()
  if (!gate.ok) return fail(gate.error)
  const c = gate.customer
  return ok({
    customer: {
      customer_id: c.customer_id,
      email: c.email,
      name: c.name,
      phone: c.phone,
      status: c.status,
    },
  })
}

export async function checkSubdomainTaken(subdomain) {
  const gate = await requireCustomer()
  if (!gate.ok) return fail(gate.error)
  const { data } = await onlyActive(
    gate.db.from('sites').select('site_id').eq('subdomain', subdomain)
  ).maybeSingle()
  return ok({ taken: !!data })
}

export async function loadTemplateList() {
  const user = await getServerUser()
  if (!user) return fail('로그인이 필요합니다.')
  const db = createAdminClient()
  const { data, error } = await onlyActive(
    db.from('templates').select(TPL_COLS)
  ).order('sort_order')
  if (error) return fail(error.message)
  return ok({ templates: data || [] })
}

async function loadTicketsBundle(db, siteId) {
  const { data } = await onlyActive(
    db.from('support_tickets').select(TICKET_COLS).eq('site_id', siteId)
  ).order('created_at', { ascending: false })
  const tickets = data || []
  const ids = tickets.map(t => t.ticket_id)
  const [ticketMsgs, ticketQuotes] = await Promise.all([
    loadCustomerTicketMessages(db, ids),
    loadTicketQuotes(db, ids),
  ])
  return { tickets, ticketMsgs, ticketQuotes }
}

export async function loadAdminHome(siteCode) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)
  const { db, customer, site } = gate
  if (customer.status === 'withdrawn') return fail('withdrawn')

  const { data: siteData } = await onlyActive(
    db.from('sites').select(SITE_ADMIN_COLS).eq('site_id', site.site_id)
  ).maybeSingle()
  if (!siteData) return fail('사이트를 찾을 수 없습니다.')

  let inquiry = null
  if (siteData.inquiry_id) {
    const { data: inq } = await onlyActive(
      db.from('inquiries').select(INQUIRY_COLS).eq('inquiry_id', siteData.inquiry_id)
    ).maybeSingle()
    inquiry = inq
  }

  const { data: subscription } = await onlyActive(
    db.from('subscriptions').select(SUB_COLS).eq('site_id', site.site_id)
  ).maybeSingle()

  const { data: paymentMethod } = await onlyActive(
    db.from('customer_payment_methods').select(PM_COLS).eq('customer_id', customer.customer_id)
  ).maybeSingle()

  let billingHistory = []
  if (subscription) {
    const { data: bh } = await onlyActive(
      db.from('billing_history').select(BH_COLS).eq('subscription_id', subscription.subscription_id)
    ).order('period', { ascending: false })
    billingHistory = bh || []
  }

  const [boards, posts, ticketBundle] = await Promise.all([
    loadBoards(db, site.site_id),
    loadPostsWithComments(db, site.site_id),
    loadTicketsBundle(db, site.site_id),
  ])

  return ok({
    customer: {
      customer_id: customer.customer_id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      status: customer.status,
    },
    site: siteData,
    inquiry,
    subscription,
    paymentMethod,
    billingHistory,
    boards,
    posts,
    ...ticketBundle,
  })
}

export async function loadAdminTickets(siteCode) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)
  return ok(await loadTicketsBundle(gate.db, gate.site.site_id))
}

export async function loadAdminBoards(siteCode) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)
  const [boards, posts] = await Promise.all([
    loadBoards(gate.db, gate.site.site_id),
    loadPostsWithComments(gate.db, gate.site.site_id),
  ])
  return ok({ boards, posts })
}

export async function loadEditorSite(siteCode) {
  const staff = await requireStaff()
  if (staff.ok) {
    const db = createAdminClient()
    const site = await findSiteByCode(db, siteCode)
    if (!site) return fail('사이트를 찾을 수 없습니다.')
    const { data } = await onlyActive(
      db.from('sites').select(SITE_EDITOR_COLS).eq('site_id', site.site_id)
    ).maybeSingle()
    return ok({ kind: 'staff', site: data, customer: null })
  }

  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)
  const { data } = await onlyActive(
    gate.db.from('sites').select(SITE_EDITOR_COLS).eq('site_id', gate.site.site_id)
  ).maybeSingle()
  return ok({
    kind: 'owner',
    site: data,
    customer: {
      customer_id: gate.customer.customer_id,
      name: gate.customer.name,
      email: gate.customer.email,
      phone: gate.customer.phone,
      status: gate.customer.status,
    },
  })
}

export async function loadPaymentSetup(siteCode) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)
  const allowed = await assertPaymentSetupAllowed(gate.db, gate.site.site_id)
  if (!allowed.ok) return fail(allowed.error)

  const { data: site } = await onlyActive(
    gate.db.from('sites').select(SITE_PAY_COLS).eq('site_id', gate.site.site_id)
  ).maybeSingle()
  const { data: subscription } = await onlyActive(
    gate.db.from('subscriptions').select(SUB_COLS).eq('site_id', gate.site.site_id)
  ).maybeSingle()
  return ok({
    site,
    subscription,
    customerName: gate.customer.name || '',
  })
}

export async function loadCardSuccessSite(siteCode) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)
  return ok({
    site: {
      site_id: gate.site.site_id,
      subdomain: gate.site.subdomain,
      name: gate.site.name,
    },
  })
}

export async function loadOwnerQuote(siteCode, paymentId) {
  const gate = await requireOwnedSiteByCode(siteCode)
  if (!gate.ok) return fail(gate.error)
  const res = await loadQuote(gate.db, paymentId, gate.customer.customer_id)
  if (!res.ok) return fail(res.error)
  if (res.quote.site_id && res.quote.site_id !== gate.site.site_id) return fail('권한이 없습니다.')
  return ok({ quote: res.quote, customerName: gate.customer.name || '' })
}

export async function loadOwnerInquiryPayment(inquiryId, stage) {
  const gate = await requireOwnedInquiry(inquiryId)
  if (!gate.ok) return fail(gate.error)
  const res = await loadInquiryForPayment(gate.db, inquiryId, gate.customer.customer_id, stage)
  if (!res.ok) return fail(res.error)
  return ok({
    inquiry: res.inquiry,
    site: res.site,
    customerName: gate.customer.name || '',
  })
}
