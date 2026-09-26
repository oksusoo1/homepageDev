import 'server-only'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { onlyActive } from '@/lib/use-flag'

export async function getServerUser() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  return user || null
}

/** 쿠키 세션 → 고객. customerId는 클라이언트에서 받지 않는다 */
export async function requireCustomer() {
  const user = await getServerUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const db = createAdminClient()
  const { data: customer } = await onlyActive(
    db.from('customers').select('*').eq('auth_id', user.id)
  ).maybeSingle()
  if (!customer) return { ok: false, error: '고객 정보가 없습니다.' }
  return { ok: true, user, customer, db }
}

export async function findSiteByCode(db, siteCode) {
  if (!siteCode) return null
  let { data } = await onlyActive(
    db.from('sites').select('*').eq('subdomain', siteCode)
  ).maybeSingle()
  if (!data) {
    ;({ data } = await onlyActive(
      db.from('sites').select('*').eq('site_code', siteCode)
    ).maybeSingle())
  }
  return data || null
}

/**
 * 본사 직원 확인. 실패 시 { ok:false, error }
 * @param {string[]} [roles]
 */
export async function requireStaff(roles = ['platform_admin']) {
  const user = await getServerUser()
  if (!user) return { ok: false, error: '로그인이 필요합니다.' }

  const db = createAdminClient()
  const { data: staff, error } = await db
    .from('staff')
    .select('*')
    .eq('auth_id', user.id)
    .eq('status', 'active')
    .eq('use_flag', 1)
    .maybeSingle()

  if (error) return { ok: false, error: '권한 확인에 실패했습니다.' }
  if (!staff) return { ok: false, error: '권한이 없습니다.' }
  if (roles.length && !roles.includes(staff.role)) {
    return { ok: false, error: '권한이 없습니다.' }
  }
  return { ok: true, user, staff }
}

/**
 * 사이트 소유 고객인지 확인. siteId는 서버가 조회한 값만.
 * @param {string} siteId
 */
export async function requireSiteOwner(siteId) {
  const gate = await requireCustomer()
  if (!gate.ok) return gate

  const { db, customer, user } = gate
  const { data: site } = await onlyActive(
    db.from('sites').select('*').eq('site_id', siteId)
  ).maybeSingle()
  if (!site) return { ok: false, error: '사이트를 찾을 수 없습니다.' }
  if (site.customer_id !== customer.customer_id) {
    return { ok: false, error: '권한이 없습니다.' }
  }
  return { ok: true, user, customer, site, db }
}

/** 클라이언트는 siteCode만 넘긴다 */
export async function requireOwnedSiteByCode(siteCode) {
  const gate = await requireCustomer()
  if (!gate.ok) return gate

  const site = await findSiteByCode(gate.db, siteCode)
  if (!site) return { ok: false, error: '사이트를 찾을 수 없습니다.' }
  if (site.customer_id !== gate.customer.customer_id) {
    return { ok: false, error: '권한이 없습니다.' }
  }
  return { ok: true, user: gate.user, customer: gate.customer, site, db: gate.db }
}

/** /my 1회성·접수취소 — inquiry 소유 확인 */
export async function requireOwnedInquiry(inquiryId) {
  const gate = await requireCustomer()
  if (!gate.ok) return gate
  if (!inquiryId) return { ok: false, error: '제작 의뢰를 찾을 수 없습니다.' }

  const { data: inquiry } = await onlyActive(
    gate.db.from('inquiries').select('*').eq('inquiry_id', inquiryId)
  ).maybeSingle()
  if (!inquiry) return { ok: false, error: '제작 의뢰를 찾을 수 없습니다.' }
  if (inquiry.customer_id !== gate.customer.customer_id) {
    return { ok: false, error: '권한이 없습니다.' }
  }

  const { data: site } = await onlyActive(
    gate.db.from('sites').select('*').eq('inquiry_id', inquiryId)
  ).maybeSingle()

  return {
    ok: true,
    user: gate.user,
    customer: gate.customer,
    inquiry,
    site: site || null,
    db: gate.db,
  }
}
