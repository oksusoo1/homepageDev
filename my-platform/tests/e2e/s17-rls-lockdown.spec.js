import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './helpers/env.js'
import { recordScenario, addDbCheck } from './helpers/report.js'

const ID = 'S17'

const TABLES = [
  'sites', 'customers', 'subscriptions', 'billing_history', 'one_time_payments',
  'customer_payment_methods', 'staff', 'user_posts', 'support_tickets', 'inquiries',
]

function anonClient() {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC Supabase 키가 없습니다.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function probeSelect(db, table) {
  const { data, error } = await db.from(table).select('*').limit(5)
  return { rows: data?.length || 0, error: error?.message || null }
}

test('S17 DB 직접 접근 차단 — anon 키로 select/insert/update', async () => {
  recordScenario({ id: ID })
  const db = anonClient()

  const sites = await probeSelect(db, 'sites')
  const locked = !!sites.error || sites.rows === 0
  addDbCheck(ID, 'sites_anon_rows', sites.rows)
  addDbCheck(ID, 'sites_anon_error', sites.error)

  if (!locked) {
    recordScenario({ id: ID, lockdownWaiting: true })
    addDbCheck(ID, 'lockdown', 'waiting')
    return
  }

  for (const table of TABLES) {
    const r = await probeSelect(db, table)
    addDbCheck(ID, `${table}_rows`, r.rows)
    expect(r.rows === 0 || !!r.error, `${table} anon select`).toBe(true)
  }

  const ins = await db.from('staff').insert({ email: 'anon-probe@test.local', name: 'probe', role: 'platform_admin' })
  expect(ins.error, 'staff insert 차단').toBeTruthy()

  const upd = await db.from('sites').update({ name: 'hacked' }).eq('use_flag', 1)
  expect(upd.error || (upd.data || []).length === 0, 'sites update 차단').toBeTruthy()
  addDbCheck(ID, 'lockdown', 'active')
})
