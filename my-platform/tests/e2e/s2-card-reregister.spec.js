import { test, expect } from '@playwright/test'
import { prepareSelfTrial, fillCard } from './helpers/flow.js'
import { countActiveCards, countPaidBilling, getCustomerByEmail, getSiteBySubdomain } from './helpers/db.js'
import { ACCOUNTS } from './helpers/env.js'
import { recordScenario, addDbCheck } from './helpers/report.js'
import { shot } from './helpers/shot.js'

const ID = 'S2'

test('S2 체험 중 카드 재등록', async ({ page }) => {
  recordScenario({ id: ID })
  const { subdomain } = await prepareSelfTrial(page, {
    scenarioId: ID,
    scenarioKey: 's2',
    shotPrefix: 's2',
    last4: '1111',
  })
  recordScenario({ id: ID, site: subdomain })

  const cust = await getCustomerByEmail(ACCOUNTS.a)
  await page.goto(`/s/${subdomain}/admin/payment/card`)
  await page.getByTestId('card-number').waitFor({ state: 'visible', timeout: 20000 })
  await shot(page, ID, 's2-09-reregister')
  await fillCard(page, '4242')
  await expect.poll(async () => {
    const cards = await countActiveCards(cust.customer_id)
    return cards.map(c => c.card_last4).join(',')
  }, { timeout: 45000 }).toBe('4242')
  await shot(page, ID, 's2-10-done')

  const site = await getSiteBySubdomain(subdomain)
  const cards = await countActiveCards(cust.customer_id)
  const paid = await countPaidBilling(site.site_id)
  addDbCheck(ID, 'sites.status', site.status)
  addDbCheck(ID, 'billing_history.paid', paid)
  addDbCheck(ID, 'active_cards', cards.length)
  addDbCheck(ID, 'card_last4', cards.map(c => c.card_last4).join(','))

  expect(site.status).toBe('trial')
  expect(paid, '체험 중 재등록은 청구 없음').toBe(0)
  expect(cards.length, '활성 카드 1장').toBe(1)
})
