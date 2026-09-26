import { mkdirSync } from 'fs'
import { resolve } from 'path'
import { addShot } from './report.js'
import { loadEnv } from './env.js'

loadEnv()

export async function shot(page, scenarioId, label) {
  const dir = process.env.E2E_SHOT_DIR || 'test-results/captures'
  mkdirSync(dir, { recursive: true })
  const safe = String(label).replace(/[^\w가-힣.-]+/g, '_')
  const file = resolve(dir, `${safe}.png`)
  await page.screenshot({ path: file, fullPage: true })
  addShot(scenarioId, label, file)
  return file
}
