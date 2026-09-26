import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './env.js'

let _db

export function adminDb() {
  if (_db) return _db
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL 이 없습니다.')
  _db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _db
}

export async function getCustomerByEmail(email) {
  const { data, error } = await adminDb()
    .from('customers')
    .select('*')
    .eq('email', email)
    .eq('use_flag', 1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getSiteBySubdomain(subdomain) {
  const { data, error } = await adminDb()
    .from('sites')
    .select('*')
    .eq('subdomain', subdomain)
    .eq('use_flag', 1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getSubscriptionBySiteId(siteId) {
  const { data, error } = await adminDb()
    .from('subscriptions')
    .select('*')
    .eq('site_id', siteId)
    .eq('use_flag', 1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function listBilling(siteId) {
  const sub = await getSubscriptionBySiteId(siteId)
  if (!sub) return []
  const { data, error } = await adminDb()
    .from('billing_history')
    .select('*')
    .eq('subscription_id', sub.subscription_id)
    .eq('use_flag', 1)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function countPaidBilling(siteId) {
  const rows = await listBilling(siteId)
  return rows.filter(r => r.status === 'paid').length
}

export async function countActiveCards(customerId) {
  const { data, error } = await adminDb()
    .from('customer_payment_methods')
    .select('payment_method_id, card_last4, use_flag')
    .eq('customer_id', customerId)
    .eq('use_flag', 1)
  if (error) throw error
  return data || []
}

export async function listOtpsForSite(siteId, { stage } = {}) {
  let q = adminDb()
    .from('one_time_payments')
    .select('*')
    .eq('site_id', siteId)
    .eq('type', 'dev_fee')
    .eq('use_flag', 1)
  if (stage) q = q.eq('stage', stage)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getInquiry(inquiryId) {
  const { data, error } = await adminDb()
    .from('inquiries')
    .select('*')
    .eq('inquiry_id', inquiryId)
    .eq('use_flag', 1)
    .maybeSingle()
  if (error) throw error
  return data
}

export function addDaysYmd(ymd, n) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function toYmd(value) {
  if (!value) return null
  return String(value).slice(0, 10)
}
