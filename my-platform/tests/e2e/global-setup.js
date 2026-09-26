import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { loadEnv, ACCOUNTS, e2ePassword } from './helpers/env.js'
import { adminDb, getCustomerByEmail } from './helpers/db.js'

function seoulStamp() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const g = t => parts.find(p => p.type === t).value
  return `${g('year')}-${g('month')}-${g('day')}_${g('hour')}${g('minute')}`
}

async function ensureAuthUser(db, email, password) {
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (!error && created?.user) return created.user

  const { data: listed, error: listErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listErr) throw listErr
  const existing = (listed?.users || []).find(u => u.email === email)
  if (!existing) {
    throw new Error(`계정 생성 실패 (${email}): ${error?.message || 'unknown'}`)
  }
  await db.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
  return existing
}

export default async function globalSetup() {
  loadEnv()
  const stamp = seoulStamp()
  process.env.E2E_RUN_STAMP = stamp
  process.env.E2E_SHOT_DIR = resolve('test-results/captures', stamp)
  process.env.E2E_META_FILE = resolve('test-results/runs', stamp, 'e2e-meta.json')
  process.env.E2E_DOC_PATH = resolve('docs/테스트결과', `${stamp}.md`)
  process.env.E2E_STARTED_AT = new Date().toISOString()

  mkdirSync(process.env.E2E_SHOT_DIR, { recursive: true })
  mkdirSync(resolve('docs/테스트결과'), { recursive: true })
  mkdirSync(resolve('test-results/runs', stamp), { recursive: true })
  writeFileSync(resolve('test-results/e2e-run.json'), JSON.stringify({
    E2E_RUN_STAMP: stamp,
    E2E_SHOT_DIR: process.env.E2E_SHOT_DIR,
    E2E_META_FILE: process.env.E2E_META_FILE,
    E2E_DOC_PATH: process.env.E2E_DOC_PATH,
    E2E_STARTED_AT: process.env.E2E_STARTED_AT,
    E2E_BASE_URL: process.env.E2E_BASE_URL || 'http://localhost:3000',
  }, null, 2))
  writeFileSync(process.env.E2E_META_FILE, JSON.stringify({
    stamp,
    baseUrl: process.env.E2E_BASE_URL || 'http://localhost:3000',
    startedAt: process.env.E2E_STARTED_AT,
    scenarios: {},
  }, null, 2))

  const db = adminDb()
  const password = e2ePassword()

  for (const [key, email] of Object.entries(ACCOUNTS)) {
    const user = await ensureAuthUser(db, email, password)
    let customer = await getCustomerByEmail(email)
    if (!customer) {
      const { data, error } = await db.from('customers').insert({
        auth_id: user.id,
        email,
        name: key === 'staff' ? 'E2E 본사' : `E2E ${key.toUpperCase()}`,
        phone: '010-0000-0000',
        status: 'active',
      }).select('*').single()
      if (error) throw new Error(`customers 생성 실패 (${email}): ${error.message}`)
      customer = data
    } else if (customer.auth_id !== user.id) {
      await db.from('customers').update({ auth_id: user.id, status: 'active' }).eq('customer_id', customer.customer_id)
    }

    if (key === 'staff') {
      const { data: staff } = await db.from('staff').select('*').eq('auth_id', user.id).maybeSingle()
      if (!staff) {
        const { error } = await db.from('staff').insert({
          auth_id: user.id,
          email,
          name: 'E2E 본사',
          role: 'platform_admin',
          status: 'active',
        })
        if (error) throw new Error(`staff 생성 실패: ${error.message}`)
      } else if (staff.role !== 'platform_admin' || staff.status !== 'active') {
        await db.from('staff').update({
          role: 'platform_admin',
          status: 'active',
          email,
        }).eq('staff_id', staff.staff_id)
      }
    }
  }
}
