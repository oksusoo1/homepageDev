import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = process.cwd()

function applyFileEnv(envPath) {
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

export function loadEnv() {
  applyFileEnv(resolve(ROOT, '.env.local'))
  const runPath = resolve(ROOT, 'test-results/e2e-run.json')
  if (existsSync(runPath)) {
    try {
      const run = JSON.parse(readFileSync(runPath, 'utf8'))
      for (const [k, v] of Object.entries(run)) {
        if (v != null && !process.env[k]) process.env[k] = String(v)
      }
    } catch { /* ignore */ }
  }
}

export const ACCOUNTS = {
  staff: 'e2e-staff@test.local',
  a: 'e2e-a@test.local',
  b: 'e2e-b@test.local',
}

export function e2ePassword() {
  const pw = process.env.E2E_PASSWORD
  if (!pw) throw new Error('E2E_PASSWORD 가 .env.local 에 없습니다.')
  return pw
}

export function baseUrl() {
  return process.env.E2E_BASE_URL || 'http://localhost:3000'
}

export function uniqueSubdomain(scenario) {
  const stamp = Date.now().toString(36)
  return `e2e-${scenario}-${stamp}`.toLowerCase()
}
