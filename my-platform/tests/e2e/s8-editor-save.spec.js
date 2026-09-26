import { test, expect } from '@playwright/test'
import { createSelfSite } from './helpers/flow.js'
import { getSiteBySubdomain } from './helpers/db.js'
import { recordScenario, addDbCheck } from './helpers/report.js'
import { shot } from './helpers/shot.js'

const ID = 'S8'

test('S8 에디터 저장 — content 반영, status 불변', async ({ page }) => {
  recordScenario({ id: ID, title: '에디터 저장' })
  const { subdomain, site } = await createSelfSite(page, {
    scenarioId: ID,
    scenarioKey: 's8',
    shotPrefix: 's8',
  })
  recordScenario({ id: ID, site: subdomain })

  const before = await getSiteBySubdomain(subdomain)
  expect(before.status).toBe('building')

  await page.goto(`/s/${subdomain}/admin/editor`)
  await page.getByTestId('editor-hero-title').waitFor({ state: 'visible', timeout: 20000 })
  const title = `E2E hero ${Date.now()}`
  await page.getByTestId('editor-hero-title').fill(title)
  await page.getByTestId('editor-save').click()
  await expect(page.getByText('저장됨')).toBeVisible({ timeout: 15000 })
  await shot(page, ID, 's8-05-saved')

  await expect.poll(async () => (await getSiteBySubdomain(subdomain))?.content?.hero?.title, {
    timeout: 20000,
  }).toBe(title)

  const after = await getSiteBySubdomain(subdomain)
  addDbCheck(ID, 'content.hero.title', after.content?.hero?.title)
  addDbCheck(ID, 'sites.status', after.status)
  addDbCheck(ID, 'sites.build_type', after.build_type)
  expect(after.status, 'status 불변').toBe(before.status)
  expect(after.build_type).toBe(before.build_type)
  expect(after.customer_id).toBe(site.customer_id)
  expect(after.subdomain).toBe(subdomain)
})
