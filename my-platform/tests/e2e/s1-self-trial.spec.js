import { test, expect } from '@playwright/test'
import { prepareSelfTrial } from './helpers/flow.js'
import { countPaidBilling, getSiteBySubdomain } from './helpers/db.js'
import { recordScenario, addDbCheck } from './helpers/report.js'

const ID = 'S1'

test('S1 셀프 생성 → 카드 등록 → 서비스 시작', async ({ page }) => {
  recordScenario({ id: ID, title: '셀프 trial' })
  const { subdomain, site } = await prepareSelfTrial(page, {
    scenarioId: ID,
    scenarioKey: 's1',
    shotPrefix: 's1',
  })
  recordScenario({ id: ID, site: subdomain })

  const fresh = await getSiteBySubdomain(subdomain)
  const paid = await countPaidBilling(fresh.site_id)
  addDbCheck(ID, 'sites.status', fresh.status)
  addDbCheck(ID, 'billing_history.paid', paid)
  addDbCheck(ID, 'sites.trial_ends_at', fresh.trial_ends_at)

  expect(fresh.status, 'sites.status 는 trial').toBe('trial')
  expect(paid, 'billing_history paid 0건').toBe(0)
  expect(site.site_id).toBeTruthy()
})
