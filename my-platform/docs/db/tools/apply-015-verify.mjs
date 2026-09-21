/**
 * 015 마이그레이션 적용 확인 + (가능 시) 데이터 이관
 * DDL(CHECK/트리거)은 Supabase SQL Editor에서 015 SQL 실행 필요.
 *
 *   node docs/db/tools/apply-015-verify.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../../..')

function loadEnv() {
  const p = join(ROOT, '.env.local')
  if (!existsSync(p)) throw new Error('.env.local 없음')
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const i = t.indexOf('=')
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

const FLOW = new Set([
  'intake', 'deposit', 'building', 'preview', 'balance',
  'pay_method', 'trial', 'subscribed', 'suspended',
])

async function main() {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const sb = createClient(url, key)

  const probeId = '07744dec-ade0-4282-8670-ce6156df50df'
  const { data: before } = await sb.from('sites').select('status').eq('site_id', probeId).maybeSingle()
  const prev = before?.status

  const { error: probeErr } = await sb.from('sites').update({ status: 'building' }).eq('site_id', probeId)
  if (probeErr) {
    console.log('❌ CHECK 미적용 — sites.status 에 FLOW 코드 불가')
    console.log('   → Supabase SQL Editor에서 015_sites_status_is_flow_step.sql 전체 Run')
    console.log('   파일: docs/db/sql/migrations/015_sites_status_is_flow_step.sql')
    if (prev) await sb.from('sites').update({ status: prev }).eq('site_id', probeId)
    process.exit(2)
  }
  if (prev) await sb.from('sites').update({ status: prev }).eq('site_id', probeId)

  console.log('✅ CHECK 허용 (FLOW 코드 OK)')

  const { data: sites } = await sb.from('sites').select('site_id, subdomain, build_type, status, inquiry_id, trial_started_at').eq('use_flag', 1)
  const legacy = (sites || []).filter(s => !FLOW.has(s.status))
  console.log(`sites use_flag=1: ${sites?.length || 0}, legacy status: ${legacy.length}`)
  for (const s of legacy) console.log('  -', s.subdomain, s.status, s.build_type)

  const { data: flowCodes } = await sb.from('common_codes')
    .select('group_code, code, use_flag')
    .eq('group_code', 'FLOW_STEP')
    .order('sort_order')
  console.log('common_codes FLOW_STEP:', flowCodes?.map(c => `${c.code}(f=${c.use_flag})`).join(', ') || '(none)')

  const { error: cgErr } = await sb.from('code_groups').select('group_code').limit(1)
  if (!cgErr) console.log('⚠ code_groups 아직 있음 — 017 미적용?')
  else console.log('✅ code_groups 없음 (017 OK)')

  // 015 SQL의 UPDATE와 동일 로직을 JS로 (레거시 행만)
  for (const s of legacy) {
    let next = 'building'
    if (s.status === 'suspended' || s.status === 'cancelled') next = 'suspended'
    else if (s.status === 'published') next = s.trial_started_at ? 'trial' : 'pay_method'
    else if (s.status === 'review') next = 'preview'
    else if (s.status === 'draft') {
      if (s.build_type === 'managed' && s.inquiry_id) {
        const { data: inq } = await sb.from('inquiries').select('status, final_paid_at, down_paid_at').eq('inquiry_id', s.inquiry_id).maybeSingle()
        if (!inq?.down_paid_at && inq?.status === 'received') next = 'intake'
        else if (!inq?.down_paid_at) next = 'deposit'
        else if (inq?.final_paid_at) next = 'pay_method'
        else if (inq?.status === 'review') next = 'preview'
        else next = 'building'
      } else next = 'building'
    }
    const { error } = await sb.from('sites').update({ status: next, updated_at: new Date().toISOString() }).eq('site_id', s.site_id)
    console.log(error ? `  FAIL ${s.subdomain}: ${error.message}` : `  OK ${s.subdomain} → ${next}`)
  }

  const { data: after } = await sb.from('sites').select('subdomain, status, build_type').eq('use_flag', 1)
  console.log('결과:', after)
}

main().catch(e => { console.error(e); process.exit(1) })
