/**
 * e2e- 접두어 테스트 데이터만 FK 순서로 삭제. 계정 3개는 남긴다.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function loadEnv() {
  const envPath = resolve(ROOT, '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const E2E_EMAILS = ['e2e-staff@test.local', 'e2e-a@test.local', 'e2e-b@test.local']

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function del(table, col, ids) {
  if (!ids.length) return 0
  const { error, count } = await db.from(table).delete({ count: 'exact' }).in(col, ids)
  if (error) throw new Error(`${table} 삭제 실패: ${error.message}`)
  return count || 0
}

async function main() {
  const { data: sites, error: sErr } = await db
    .from('sites')
    .select('site_id, inquiry_id, subdomain, customer_id')
    .like('subdomain', 'e2e-%')
  if (sErr) throw sErr

  const siteIds = (sites || []).map(s => s.site_id)
  const inquiryIds = [...new Set((sites || []).map(s => s.inquiry_id).filter(Boolean))]

  const { data: customers } = await db
    .from('customers')
    .select('customer_id, email')
    .in('email', E2E_EMAILS)

  const customerIds = (customers || []).map(c => c.customer_id)

  const { data: subs } = siteIds.length
    ? await db.from('subscriptions').select('subscription_id').in('site_id', siteIds)
    : { data: [] }
  const subIds = (subs || []).map(s => s.subscription_id)

  const { data: tickets } = siteIds.length
    ? await db.from('support_tickets').select('ticket_id').in('site_id', siteIds)
    : { data: [] }
  const ticketIds = (tickets || []).map(t => t.ticket_id)

  const { data: posts } = siteIds.length
    ? await db.from('user_posts').select('post_id').in('site_id', siteIds)
    : { data: [] }
  const postIds = (posts || []).map(p => p.post_id)

  const { data: boards } = siteIds.length
    ? await db.from('user_boards').select('user_board_id').in('site_id', siteIds)
    : { data: [] }
  const boardIds = (boards || []).map(b => b.user_board_id)

  const counts = {}
  if (subIds.length) {
    const { data: bills } = await db.from('billing_history').select('billing_id').in('subscription_id', subIds)
    counts.billing_history = await del('billing_history', 'billing_id', (bills || []).map(b => b.billing_id))
  } else {
    counts.billing_history = 0
  }

  if (siteIds.length) {
    const { error: logErr, count: logCount } = await db
      .from('notification_logs')
      .delete({ count: 'exact' })
      .in('site_id', siteIds)
    if (logErr) console.warn('notification_logs:', logErr.message)
    else counts.notification_logs = logCount || 0
  }

  counts.subscriptions = await del('subscriptions', 'subscription_id', subIds)
  if (siteIds.length) {
    const { error: otpErr, count } = await db.from('one_time_payments').delete({ count: 'exact' }).in('site_id', siteIds)
    if (otpErr) throw otpErr
    counts.one_time_payments = count || 0
  } else {
    counts.one_time_payments = 0
  }

  if (ticketIds.length) {
    await db.from('support_ticket_messages').delete().in('ticket_id', ticketIds)
  }
  counts.support_tickets = await del('support_tickets', 'ticket_id', ticketIds)
  counts.user_comments = postIds.length
    ? (await db.from('user_comments').delete({ count: 'exact' }).in('post_id', postIds)).count || 0
    : 0
  counts.user_posts = await del('user_posts', 'post_id', postIds)
  counts.user_boards = await del('user_boards', 'user_board_id', boardIds)
  counts.sites = await del('sites', 'site_id', siteIds)
  counts.inquiries = await del('inquiries', 'inquiry_id', inquiryIds)

  if (customerIds.length) {
    const { error: pmErr, count } = await db
      .from('customer_payment_methods')
      .delete({ count: 'exact' })
      .in('customer_id', customerIds)
    if (pmErr) throw pmErr
    counts.customer_payment_methods = count || 0
  }

  console.log('e2e 데이터 정리 완료 (계정 3개 유지)')
  console.log(counts)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
