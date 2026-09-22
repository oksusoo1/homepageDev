/**
 * 개발용 DB 조회 CLI (Supabase REST)
 *
 * 사용 (my-platform 루트 또는 이 폴더에서):
 *   node docs/db/tools/db-query.mjs snapshot
 *   node docs/db/tools/db-query.mjs sites
 *   node docs/db/tools/db-query.mjs inquiries
 *   node docs/db/tools/db-query.mjs customers --email test2@test.com
 *   node docs/db/tools/db-query.mjs sites --subdomain magokcafe4
 *   node docs/db/tools/db-query.mjs one --table sites --id <uuid> --id-col site_id
 *
 * 환경: my-platform/.env.local 의
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 * (선택) SUPABASE_SERVICE_ROLE_KEY — 있으면 RLS 우회 조회
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PLATFORM_ROOT = resolve(__dirname, '../../..')

function loadEnvLocal() {
  const envPath = join(PLATFORM_ROOT, '.env.local')
  if (!existsSync(envPath)) {
    throw new Error(`.env.local 없음: ${envPath}`)
  }
  const text = readFileSync(envPath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
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

function client() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / ANON(또는 SERVICE_ROLE) KEY 필요')
  }
  const mode = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon'
  return { sb: createClient(url, key), mode, url }
}

function argVal(args, name) {
  const i = args.indexOf(name)
  if (i < 0 || i + 1 >= args.length) return null
  return args[i + 1]
}

function hasFlag(args, name) {
  return args.includes(name)
}

function printJson(data) {
  console.log(JSON.stringify(data, null, 2))
}

async function cmdSnapshot(sb) {
  const tables = [
    'customers',
    'staff',
    'sites',
    'inquiries',
    'subscriptions',
    'one_time_payments',
    'support_tickets',
    'templates',
    'user_posts',
    'user_messages',
  ]
  const out = {}
  for (const t of tables) {
    const active = await sb.from(t).select('*', { count: 'exact', head: true }).eq('use_flag', 1)
    const all = await sb.from(t).select('*', { count: 'exact', head: true })
    out[t] = {
      use_flag_1: active.count,
      all: all.count,
      error: active.error?.message || all.error?.message || null,
    }
  }
  printJson(out)
}

async function cmdList(sb, table, opts) {
  let q = sb.from(table).select(opts.select || '*').order('created_at', { ascending: false }).limit(opts.limit)

  if (!opts.all) q = q.eq('use_flag', 1)
  if (opts.email) {
    if (table === 'customers') q = q.eq('email', opts.email)
    else if (table === 'inquiries' || table === 'sites') {
      // join filter via customers: fetch customer_id first
      const { data: cust, error } = await sb.from('customers').select('customer_id').eq('email', opts.email).maybeSingle()
      if (error) throw error
      if (!cust) {
        printJson({ table, email: opts.email, rows: [], note: 'customer not found' })
        return
      }
      q = q.eq('customer_id', cust.customer_id)
    }
  }
  if (opts.subdomain) q = q.eq('subdomain', opts.subdomain)
  if (opts.status) q = q.eq('status', opts.status)
  if (opts.build_type) q = q.eq('build_type', opts.build_type)

  const { data, error } = await q
  if (error) throw error
  printJson({ table, count: data?.length ?? 0, rows: data })
}

async function cmdOne(sb, opts) {
  const table = opts.table
  const idCol = opts.idCol
  const id = opts.id
  if (!table || !idCol || !id) {
    throw new Error('--table --id-col --id 필요')
  }
  let q = sb.from(table).select('*').eq(idCol, id)
  if (!opts.all) q = q.eq('use_flag', 1)
  const { data, error } = await q.maybeSingle()
  if (error) throw error
  printJson({ table, row: data })
}

async function cmdRelated(sb, email) {
  const { data: cust, error: cErr } = await sb
    .from('customers')
    .select('*')
    .eq('email', email)
    .eq('use_flag', 1)
    .maybeSingle()
  if (cErr) throw cErr
  if (!cust) {
    printJson({ email, note: 'customer not found (use_flag=1)' })
    return
  }
  const cid = cust.customer_id
  const [sites, inquiries, subs, otps] = await Promise.all([
    sb.from('sites').select('*').eq('customer_id', cid).eq('use_flag', 1).order('created_at', { ascending: false }),
    sb.from('inquiries').select('*').eq('customer_id', cid).eq('use_flag', 1).order('created_at', { ascending: false }),
    sb.from('subscriptions').select('*').eq('customer_id', cid).eq('use_flag', 1),
    sb.from('one_time_payments').select('*').eq('customer_id', cid).eq('use_flag', 1),
  ])
  printJson({
    customer: cust,
    sites: sites.data,
    inquiries: inquiries.data,
    subscriptions: subs.data,
    one_time_payments: otps.data,
    errors: {
      sites: sites.error?.message,
      inquiries: inquiries.error?.message,
      subscriptions: subs.error?.message,
      one_time_payments: otps.error?.message,
    },
  })
}

function usage() {
  console.log(`DB 조회 CLI

  node docs/db/tools/db-query.mjs snapshot
  node docs/db/tools/db-query.mjs customers [--email x]
  node docs/db/tools/db-query.mjs sites [--email x] [--subdomain x] [--status trial] [--build_type managed]
  node docs/db/tools/db-query.mjs inquiries [--email x]
  node docs/db/tools/db-query.mjs related --email test2@test.com
  node docs/db/tools/db-query.mjs one --table sites --id-col site_id --id <uuid>

옵션:
  --limit N     기본 20
  --all         use_flag 무시 (삭제 포함)
  --select a,b  컬럼 지정
`)
}

async function main() {
  const args = process.argv.slice(2)
  const cmd = args[0]
  if (!cmd || cmd === '-h' || cmd === '--help') {
    usage()
    process.exit(0)
  }

  const { sb, mode, url } = client()
  console.error(`[db-query] ${url} (${mode})`)

  const opts = {
    limit: Number(argVal(args, '--limit') || 20),
    all: hasFlag(args, '--all'),
    email: argVal(args, '--email'),
    subdomain: argVal(args, '--subdomain'),
    status: argVal(args, '--status'),
    build_type: argVal(args, '--build_type'),
    select: argVal(args, '--select'),
    table: argVal(args, '--table'),
    idCol: argVal(args, '--id-col'),
    id: argVal(args, '--id'),
  }

  if (cmd === 'snapshot') await cmdSnapshot(sb)
  else if (cmd === 'related') {
    if (!opts.email) throw new Error('--email 필요')
    await cmdRelated(sb, opts.email)
  } else if (cmd === 'one') await cmdOne(sb, opts)
  else if (['customers', 'sites', 'inquiries', 'subscriptions', 'staff', 'one_time_payments', 'templates'].includes(cmd)) {
    await cmdList(sb, cmd, opts)
  } else {
    usage()
    process.exit(1)
  }
}

main().catch(err => {
  console.error('[db-query] ERROR:', err.message || err)
  process.exit(1)
})
