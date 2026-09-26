import { test, expect } from '@playwright/test'
import { e2ePassword } from './helpers/env.js'
import { getCustomerByEmail, adminDb } from './helpers/db.js'
import { recordScenario, addDbCheck } from './helpers/report.js'
import { shot } from './helpers/shot.js'

const ID = 'S13'

test('S13 신규 가입 — customers.auth_id·email 일치', async ({ page }) => {
  recordScenario({ id: ID })
  const stamp = Date.now()
  const email = `e2e-s13-${stamp}@test.local`
  const password = e2ePassword()

  await page.goto('/login?tab=signup')
  await page.getByTestId('signup-name').waitFor({ state: 'visible', timeout: 20000 })
  await page.getByTestId('signup-name').fill('가입테스터')
  await page.getByTestId('signup-email').fill(email)
  await page.getByTestId('signup-password').fill(password)
  await page.getByTestId('signup-password-confirm').fill(password)
  await page.getByTestId('signup-submit').click()
  await page.waitForURL(/\/my/, { timeout: 30000 })
  await shot(page, ID, 's13-01-my')

  const cust = await getCustomerByEmail(email)
  expect(cust, 'customers 행').toBeTruthy()
  expect(cust.email).toBe(email)
  expect(cust.auth_id).toBeTruthy()

  const { data: { users } } = await adminDb().auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authUser = (users || []).find(u => u.email === email)
  expect(authUser, 'auth user').toBeTruthy()
  expect(cust.auth_id).toBe(authUser.id)

  addDbCheck(ID, 'email', cust.email)
  addDbCheck(ID, 'auth_id_match', cust.auth_id === authUser.id)
  recordScenario({ id: ID, site: email })
})
