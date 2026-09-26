import { test, expect } from '@playwright/test'
import { prepareSelfTrial } from './helpers/flow.js'
import { addDaysYmd, countPaidBilling, getSiteBySubdomain, toYmd } from './helpers/db.js'
import { runBillingBatch } from './helpers/batch.js'
import { recordScenario, addDbCheck } from './helpers/report.js'
import { shot } from './helpers/shot.js'

const ID = 'S3'

test('S3 배치 asOf=체험종료일+1 → subscribed + paid 1', async ({ page }) => {
  recordScenario({ id: ID })
  const { subdomain } = await prepareSelfTrial(page, {
    scenarioId: ID,
    scenarioKey: 's3',
    shotPrefix: 's3',
  })
  recordScenario({ id: ID, site: subdomain })

  const before = await getSiteBySubdomain(subdomain)
  expect(before.status).toBe('trial')
  const asOf = addDaysYmd(toYmd(before.trial_ends_at), 1)
  addDbCheck(ID, 'trial_ends_at', before.trial_ends_at)
  addDbCheck(ID, 'asOf', asOf)

  const batch = await runBillingBatch({ asOf, onlySiteId: before.site_id })
  addDbCheck(ID, 'batch.actions', (batch.actions || []).map(a => a.task).join(','))

  const after = await getSiteBySubdomain(subdomain)
  const paid = await countPaidBilling(after.site_id)
  addDbCheck(ID, 'sites.status', after.status)
  addDbCheck(ID, 'billing_history.paid', paid)

  await page.reload()
  await shot(page, ID, 's3-09-after-batch')

  expect(after.status, 'sites.status 는 subscribed').toBe('subscribed')
  expect(paid, 'billing_history paid 1건').toBe(1)
})
