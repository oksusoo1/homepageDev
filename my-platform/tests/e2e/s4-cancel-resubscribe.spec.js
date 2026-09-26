import { test, expect } from '@playwright/test'
import { acceptDialogs } from './helpers/auth.js'
import { fillCard, openAdminBilling, prepareSelfTrial } from './helpers/flow.js'
import {
  addDaysYmd, countPaidBilling, getSiteBySubdomain, getSubscriptionBySiteId, toYmd,
} from './helpers/db.js'
import { runBillingBatch } from './helpers/batch.js'
import { recordScenario, addDbCheck } from './helpers/report.js'
import { shot } from './helpers/shot.js'

const ID = 'S4'

test('S4 해지 예약 → 배치 정지 → 카드 재구독', async ({ page }) => {
  recordScenario({ id: ID })
  acceptDialogs(page)
  const { subdomain } = await prepareSelfTrial(page, {
    scenarioId: ID,
    scenarioKey: 's4',
    shotPrefix: 's4',
  })
  recordScenario({ id: ID, site: subdomain })

  const trial = await getSiteBySubdomain(subdomain)
  const subscribeAsOf = addDaysYmd(toYmd(trial.trial_ends_at), 1)
  await runBillingBatch({ asOf: subscribeAsOf, onlySiteId: trial.site_id })
  const subscribed = await getSiteBySubdomain(subdomain)
  expect(subscribed.status).toBe('subscribed')
  const paidAfterSub = await countPaidBilling(subscribed.site_id)
  addDbCheck(ID, 'after_subscribe.status', subscribed.status)
  addDbCheck(ID, 'after_subscribe.paid', paidAfterSub)

  await openAdminBilling(page, subdomain)
  await page.getByTestId('admin-cancel-sub').waitFor({ state: 'visible', timeout: 20000 })
  await shot(page, ID, 's4-09-before-cancel')
  await page.getByTestId('admin-cancel-sub').click()
  await expect(page.getByText('해지가 예약되었습니다')).toBeVisible({ timeout: 15000 })
  await shot(page, ID, 's4-10-cancelled')

  const sub = await getSubscriptionBySiteId(subscribed.site_id)
  const cancelsAt = toYmd(sub.cancels_at)
  expect(cancelsAt).toBeTruthy()
  addDbCheck(ID, 'cancels_at', cancelsAt)

  const cancelAsOf = addDaysYmd(cancelsAt, 1)
  await runBillingBatch({ asOf: cancelAsOf, onlySiteId: subscribed.site_id })
  const suspended = await getSiteBySubdomain(subdomain)
  const paidAfterCancel = await countPaidBilling(suspended.site_id)
  addDbCheck(ID, 'after_cancel_batch.status', suspended.status)
  addDbCheck(ID, 'after_cancel_batch.paid', paidAfterCancel)
  expect(suspended.status, '해지일+1 배치 후 suspended').toBe('suspended')
  expect(paidAfterCancel, '해지 배치 후 결제 추가 없음').toBe(paidAfterSub)

  await page.goto(`/s/${subdomain}/admin`)
  await page.getByTestId('admin-nav-billing.sub').click()
  const resub = page.getByTestId('admin-resubscribe')
  await shot(page, ID, 's4-11-suspended')
  if (await resub.isVisible().catch(() => false)) {
    await resub.click()
  } else {
    // 화면은 실제 오늘 기준이라 cancels_at 이 미래면 「재구독」대신 해지예정으로 보임. 카드 화면은 동일.
    await page.goto(`/s/${subdomain}/admin/payment/card`)
  }
  await page.getByTestId('card-number').waitFor({ state: 'visible', timeout: 20000 })
  await fillCard(page, '5555')
  await expect.poll(async () => (await getSiteBySubdomain(subdomain))?.status, {
    timeout: 45000,
  }).toBe('subscribed')
  await shot(page, ID, 's4-12-resubscribed')

  const again = await getSiteBySubdomain(subdomain)
  const paidAgain = await countPaidBilling(again.site_id)
  addDbCheck(ID, 'after_resub.status', again.status)
  addDbCheck(ID, 'after_resub.paid', paidAgain)
  expect(again.status, '재구독 후 subscribed').toBe('subscribed')
  expect(paidAgain, '재구독 즉시 paid 1건 추가').toBe(paidAfterSub + 1)
})
