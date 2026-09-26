import { test, expect } from '@playwright/test'
import { loginAs, logout } from './helpers/auth.js'
import { createSelfSite } from './helpers/flow.js'
import { recordScenario, addDbCheck } from './helpers/report.js'
import { shot } from './helpers/shot.js'

const ID = 'S6'

test('S6 권한 차단 — platform / 타인 admin / cron', async ({ page, request }) => {
  recordScenario({ id: ID })
  const { subdomain } = await createSelfSite(page, {
    scenarioId: ID,
    scenarioKey: 's6',
    shotPrefix: 's6',
  })
  recordScenario({ id: ID, site: subdomain })

  await logout(page)
  await page.goto('/platform')
  await page.waitForURL(/\/login/, { timeout: 15000 })
  await shot(page, ID, 's6-05-anon-platform')
  addDbCheck(ID, 'anon_/platform', 'redirect /login')

  await loginAs(page, 'a')
  await page.goto('/platform')
  await page.waitForURL(/\/login/, { timeout: 15000 })
  await shot(page, ID, 's6-06-a-platform')
  addDbCheck(ID, 'A_/platform', 'redirect /login')

  await logout(page)
  await loginAs(page, 'b')
  await page.goto(`/s/${subdomain}/admin`)
  await page.waitForURL(/\/(my|login)/, { timeout: 20000 })
  await shot(page, ID, 's6-07-b-admin')
  expect(page.url()).toMatch(/\/(my|login)/)
  addDbCheck(ID, `B_/s/${subdomain}/admin`, new URL(page.url()).pathname)

  const res = await request.post('/api/cron/billing', {
    data: { asOf: '2026-09-26' },
    failOnStatusCode: false,
  })
  addDbCheck(ID, 'cron_no_header', res.status())
  expect(res.status(), '헤더 없이 cron → 401').toBe(401)
})
