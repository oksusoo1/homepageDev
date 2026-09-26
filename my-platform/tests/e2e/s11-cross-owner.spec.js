import { test, expect } from '@playwright/test'
import { loginAs, logout } from './helpers/auth.js'
import { createSelfSite } from './helpers/flow.js'
import { recordScenario, addDbCheck } from './helpers/report.js'
import { shot } from './helpers/shot.js'

const ID = 'S11'

test('S11 B는 A 사이트 에디터·게시판 관리에 못 들어감', async ({ page }) => {
  recordScenario({ id: ID })
  const { subdomain } = await createSelfSite(page, {
    scenarioId: ID,
    scenarioKey: 's11',
    shotPrefix: 's11',
  })
  recordScenario({ id: ID, site: subdomain })

  await logout(page)
  await loginAs(page, 'b')

  await page.goto(`/s/${subdomain}/admin`)
  await page.waitForURL(/\/(my|login)/, { timeout: 20000 })
  addDbCheck(ID, 'admin', new URL(page.url()).pathname)
  expect(page.url()).toMatch(/\/(my|login)/)

  await page.goto(`/s/${subdomain}/admin/editor`)
  await page.waitForURL(/\/(my|login)/, { timeout: 20000 })
  addDbCheck(ID, 'editor', new URL(page.url()).pathname)
  expect(page.url()).toMatch(/\/(my|login)/)
  await shot(page, ID, 's11-05-blocked')

  await page.goto(`/s/${subdomain}/admin?menu=content.boards`)
  await page.waitForURL(/\/(my|login)/, { timeout: 20000 })
  addDbCheck(ID, 'boards', new URL(page.url()).pathname)
  expect(page.url()).toMatch(/\/(my|login)/)
})
