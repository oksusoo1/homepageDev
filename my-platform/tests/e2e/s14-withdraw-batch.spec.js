import { test, expect } from '@playwright/test'
import { e2ePassword } from './helpers/env.js'
import { acceptDialogs } from './helpers/auth.js'
import { createSelfSite, fillCard } from './helpers/flow.js'
import {
  addDaysYmd, getCustomerByEmail, getSiteBySubdomain, getSubscriptionBySiteId, toYmd,
} from './helpers/db.js'
import { runBillingBatch } from './helpers/batch.js'
import { recordScenario, addDbCheck } from './helpers/report.js'
import { shot } from './helpers/shot.js'

const ID = 'S14'

test('S14 유료 구독 중 탈퇴 → 배치 asOf=withdraw_at+1 → 사이트 suspended·고객 withdrawn', async ({ page }) => {
  recordScenario({ id: ID })
  acceptDialogs(page)

  const stamp = Date.now()
  const email = `e2e-s14-${stamp}@test.local`
  const password = e2ePassword()

  await page.goto('/login?tab=signup')
  await page.getByTestId('signup-name').waitFor({ state: 'visible', timeout: 20000 })
  await page.getByTestId('signup-name').fill('탈퇴배치테스터')
  await page.getByTestId('signup-email').fill(email)
  await page.getByTestId('signup-password').fill(password)
  await page.getByTestId('signup-password-confirm').fill(password)
  await page.getByTestId('signup-submit').click()
  await page.waitForURL(/\/my/, { timeout: 30000 })

  const { subdomain } = await createSelfSite(page, {
    scenarioId: ID,
    scenarioKey: 's14',
    shotPrefix: 's14',
    skipLogin: true,
  })
  await page.goto(`/s/${subdomain}/admin/payment/card?redirect=deploy`)
  await page.getByTestId('card-number').waitFor({ state: 'visible', timeout: 60000 })
  await shot(page, ID, 's14-07-card')
  await fillCard(page, '1414')
  await expect.poll(async () => (await getSiteBySubdomain(subdomain))?.status, {
    timeout: 45000,
  }).toBe('trial')
  recordScenario({ id: ID, site: subdomain })

  const trial = await getSiteBySubdomain(subdomain)
  const subscribeAsOf = addDaysYmd(toYmd(trial.trial_ends_at), 1)
  await runBillingBatch({ asOf: subscribeAsOf, onlySiteId: trial.site_id })
  const subscribed = await getSiteBySubdomain(subdomain)
  expect(subscribed.status, '탈퇴 전 subscribed').toBe('subscribed')

  await page.goto(`/s/${subdomain}/admin?menu=settings.account`)
  await page.getByTestId('admin-withdraw-open').waitFor({ state: 'visible', timeout: 20000 })
  await page.getByTestId('admin-withdraw-open').waitFor({ state: 'visible', timeout: 15000 })
  await shot(page, ID, 's14-09-account')
  await page.getByTestId('admin-withdraw-open').click()
  await page.getByTestId('admin-withdraw-input').fill('탈퇴')
  await page.getByTestId('admin-withdraw-confirm').click()
  await page.waitForURL(/\/login/, { timeout: 20000 })
  await shot(page, ID, 's14-10-login-pending')

  const pendingCust = await getCustomerByEmail(email)
  const pendingSite = await getSiteBySubdomain(subdomain)
  const pendingSub = await getSubscriptionBySiteId(pendingSite.site_id)
  expect(pendingCust.status, '배치 전 customers.status').toBe('active')
  expect(pendingCust.withdraw_at, '배치 전 withdraw_at').toBeTruthy()
  expect(pendingSite.status, '배치 전 사이트는 유지').toBe('subscribed')
  addDbCheck(ID, 'before_batch.status', pendingCust.status)
  addDbCheck(ID, 'before_batch.withdraw_at', pendingCust.withdraw_at)
  addDbCheck(ID, 'before_batch.site', pendingSite.status)
  addDbCheck(ID, 'before_batch.cancels_at', pendingSub?.cancels_at)

  const withdrawAsOf = addDaysYmd(toYmd(pendingCust.withdraw_at), 1)
  await runBillingBatch({ asOf: withdrawAsOf, onlySiteId: pendingSite.site_id })

  const afterCust = await getCustomerByEmail(email)
  const afterSite = await getSiteBySubdomain(subdomain)
  addDbCheck(ID, 'after_batch.customer_status', afterCust.status)
  addDbCheck(ID, 'after_batch.withdraw_at', afterCust.withdraw_at)
  addDbCheck(ID, 'after_batch.site', afterSite.status)
  expect(afterSite.status, '배치 후 sites.status').toBe('suspended')
  expect(afterCust.status, '배치 후 customers.status').toBe('withdrawn')
  expect(afterCust.withdraw_at, '배치 후 withdraw_at 비움').toBeNull()
})
