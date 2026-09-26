import { test, expect } from '@playwright/test'
import { acceptDialogs, loginAs, logout } from './helpers/auth.js'
import { staffOpenSite } from './helpers/flow.js'
import { uniqueSubdomain } from './helpers/env.js'
import { getInquiry, getSiteBySubdomain, listOtpsForSite } from './helpers/db.js'
import { recordScenario, addDbCheck } from './helpers/report.js'
import { shot } from './helpers/shot.js'

const ID = 'S5'

test('S5 대리 의뢰 → 견적 → 선금 요청 → 선금 확인', async ({ page }) => {
  recordScenario({ id: ID })
  acceptDialogs(page)
  const subdomain = uniqueSubdomain('s5')
  const name = `E2E S5 ${subdomain.slice(-6)}`
  recordScenario({ id: ID, site: subdomain })

  await loginAs(page, 'b')
  await page.getByTestId('my-new-site').click()
  await page.getByTestId('my-create-managed').click()
  await page.getByTestId('inquiry-type-cafe').click()
  await page.getByTestId('inquiry-name').fill(name)
  await page.getByTestId('inquiry-subdomain').fill(subdomain)
  await page.getByTestId('inquiry-description').fill('E2E 대리제작 선금 시나리오입니다.')
  await shot(page, ID, 's5-01-inquiry')
  await page.getByTestId('inquiry-submit').click()
  await expect(page.getByText('접수가 완료되었어요')).toBeVisible({ timeout: 20000 })
  await shot(page, ID, 's5-02-inquiry-done')
  await page.getByRole('button', { name: '확인' }).click()

  const afterInquiry = await getSiteBySubdomain(subdomain)
  expect(afterInquiry).toBeTruthy()
  addDbCheck(ID, 'after_inquiry.status', afterInquiry.status)

  await logout(page)
  await staffOpenSite(page, subdomain)
  await page.getByTestId('hq-dev-fee').waitFor({ state: 'visible', timeout: 20000 })
  await page.getByTestId('hq-dev-fee').fill('200000')
  await shot(page, ID, 's5-03-quote')
  await page.getByTestId('hq-save-fee').click()
  await expect.poll(async () => (await getSiteBySubdomain(subdomain))?.status, {
    timeout: 20000,
  }).toBe('deposit')
  await shot(page, ID, 's5-04-quote-saved')

  const afterQuote = await getSiteBySubdomain(subdomain)
  addDbCheck(ID, 'after_quote.status', afterQuote.status)

  await logout(page)
  await loginAs(page, 'b')
  await page.getByTestId('my-pay-down').first().waitFor({ state: 'visible', timeout: 20000 })
  await shot(page, ID, 's5-05-my-pay')
  await page.getByTestId('my-pay-down').first().click()
  await page.getByTestId('otp-choose-bank').waitFor({ state: 'visible', timeout: 20000 })
  await page.getByTestId('otp-choose-bank').click()
  await page.getByTestId('otp-depositor').waitFor({ state: 'visible', timeout: 20000 })
  await page.getByTestId('otp-agree').check()
  await shot(page, ID, 's5-06-bank')
  await page.getByTestId('otp-submit').click()
  await expect(page.getByText('입금 확인을 요청했습니다')).toBeVisible({ timeout: 20000 })
  await shot(page, ID, 's5-07-pending')

  const pendingSite = await getSiteBySubdomain(subdomain)
  const downs = await listOtpsForSite(pendingSite.site_id, { stage: 'down' })
  const pending = downs.find(o => o.status === 'pending_confirm')
  addDbCheck(ID, 'after_deposit_request.status', pendingSite.status)
  addDbCheck(ID, 'otp.down.status', pending?.status || downs[0]?.status || null)
  expect(pending?.status, '선금 OTP pending_confirm').toBe('pending_confirm')
  expect(pendingSite.status, '입금했어요 후에도 deposit 유지').toBe('deposit')
  expect(afterQuote.status).toBe('deposit')

  await logout(page)
  await staffOpenSite(page, subdomain)
  const confirmBtn = page.getByRole('button', { name: '선금 확인' })
  await confirmBtn.waitFor({ state: 'visible', timeout: 20000 })
  await shot(page, ID, 's5-08-staff-confirm')
  await confirmBtn.click()
  await expect.poll(async () => (await getSiteBySubdomain(subdomain))?.status, {
    timeout: 20000,
  }).toBe('building')
  await shot(page, ID, 's5-09-building')

  const built = await getSiteBySubdomain(subdomain)
  const inq = await getInquiry(built.inquiry_id)
  addDbCheck(ID, 'after_confirm.status', built.status)
  addDbCheck(ID, 'down_paid_at', inq?.down_paid_at)
  expect(built.status, '선금 확인 후 building').toBe('building')
})
