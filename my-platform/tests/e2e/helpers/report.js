import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname } from 'path'
import { loadEnv } from './env.js'

loadEnv()

export function metaPath() {
  return process.env.E2E_META_FILE || 'test-results/e2e-meta.json'
}

function readMeta() {
  const p = metaPath()
  if (!existsSync(p)) return { scenarios: {} }
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return { scenarios: {} }
  }
}

export function recordScenario(partial) {
  const p = metaPath()
  mkdirSync(dirname(p), { recursive: true })
  const data = readMeta()
  const id = partial.id
  data.scenarios[id] = { ...(data.scenarios[id] || {}), ...partial, id }
  writeFileSync(p, JSON.stringify(data, null, 2), 'utf8')
}

export function addShot(id, label, file) {
  const data = readMeta()
  const cur = data.scenarios[id] || { id, shots: [] }
  cur.shots = [...(cur.shots || []), { label, file }]
  data.scenarios[id] = cur
  const p = metaPath()
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(data, null, 2), 'utf8')
}

export function addDbCheck(id, name, value) {
  const data = readMeta()
  const cur = data.scenarios[id] || { id, db: {} }
  cur.db = { ...(cur.db || {}), [name]: value }
  data.scenarios[id] = cur
  const p = metaPath()
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(data, null, 2), 'utf8')
}

export function loadMeta() {
  return readMeta()
}
