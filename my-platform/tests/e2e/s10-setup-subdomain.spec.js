import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth.js'
import { createSelfSite } from './helpers/flow.js'
import { uniqueSubdomain } from './helpers/env.js'
import { getSiteBySubdomain } from './helpers/db.js'
import { recordScenario, addDbCheck } from './helpers/report.js'
import { shot } from './helpers/shot.js'

const ID = 'S10'

async function openSetup(page) {
  await page.goto('/my')
  await page.getByTestId('my-new-site').waitFor({ state: 'visible', timeout: 20000 })
  await page.getByTestId('my-new-site').click()
  await page.getByTestId('my-create-self').click()
  await page.getByTestId('template-card').first().waitFor({ state: 'visible', timeout: 20000 })
  await page.getByTestId('template-card').first().click()
  await page.getByTestId('setup-subdomain').waitFor({ state: 'visible', timeout: 20000 })
}

async function expectRejected(page, value, snippet) {
  await page.getByTestId('setup-subdomain').fill('')
  await page.getByTestId('setup-subdomain').fill(value)
  const hint = page.getByTestId('setup-subdomain-hint')
  await expect(hint).toContainText(snippet, { timeout: 8000 })
  await expect(page.getByTestId('setup-submit')).toBeDisabled()
}

test('S10 /setup 주소 검사 — 2자·31자·예약어·대문자·중복 거절, 정상 생성', async ({ page }) => {
  recordScenario({ id: ID, title: '주소 검사' })
  const { subdomain: taken } = await createSelfSite(page, {
    scenarioId: ID,
    scenarioKey: 's10',
    shotPrefix: 's10',
  })

  await openSetup(page)
  await page.getByTestId('setup-name').fill('주소검사')

  await expectRejected(page, 'ab', '3자')
  addDbCheck(ID, 'reject_2char', true)

  await expectRejected(page, 'a'.repeat(31), '30자')
  addDbCheck(ID, 'reject_31char', true)

  await expectRejected(page, 'admin', '사용할 수 없')
  addDbCheck(ID, 'reject_reserved', true)

  await expectRejected(page, 'Admin', '소문자')
  addDbCheck(ID, 'reject_upper', true)

  await page.getByTestId('setup-subdomain').fill(taken)
  await expect(page.getByTestId('setup-subdomain-hint')).toContainText('이미 사용', { timeout: 8000 })
  await expect(page.getByTestId('setup-submit')).toBeDisabled()
  addDbCheck(ID, 'reject_dup', taken)
  await shot(page, ID, 's10-05-rejects')

  const okSub = uniqueSubdomain('s10ok')
  await page.getByTestId('setup-subdomain').fill(okSub)
  await expect(page.getByTestId('setup-submit')).toBeEnabled({ timeout: 15000 })
  await page.getByTestId('setup-submit').click()
  await expect(page.getByTestId(`my-site-admin-${okSub}`)).toBeVisible({ timeout: 30000 })

  const created = await getSiteBySubdomain(okSub)
  addDbCheck(ID, 'created_subdomain', okSub)
  addDbCheck(ID, 'created_status', created?.status)
  expect(created?.status).toBe('building')
  expect(created?.build_type).toBe('self')
  expect((created?.site_code || '').length).toBeLessThanOrEqual(50)
})
