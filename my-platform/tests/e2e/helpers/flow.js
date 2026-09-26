import { expect } from '@playwright/test'
import { uniqueSubdomain } from './env.js'
import { loginAs, logout } from './auth.js'
import { getSiteBySubdomain } from './db.js'
import { shot } from './shot.js'

export async function fillCard(page, last4 = '1111') {
  await page.getByTestId('card-number').fill(`411111111111${last4}`)
  await page.getByTestId('card-expiry').fill('1228')
  await page.getByTestId('card-birth').fill('900101')
  await page.getByTestId('card-pw').fill('12')
  await page.getByTestId('card-submit').click()
}

export async function createSelfSite(page, { scenarioId, scenarioKey, shotPrefix }) {
  const subdomain = uniqueSubdomain(scenarioKey)
  const name = `E2E ${scenarioKey.toUpperCase()} ${subdomain.slice(-6)}`

  await loginAs(page, 'a')
  await page.getByTestId('my-new-site').waitFor({ state: 'visible', timeout: 20000 })
  if (shotPrefix) await shot(page, scenarioId, `${shotPrefix}-01-my`)

  await page.getByTestId('my-new-site').click()
  await page.getByTestId('my-create-self').click()
  await page.getByTestId('template-card').first().waitFor({ state: 'visible', timeout: 20000 })
  if (shotPrefix) await shot(page, scenarioId, `${shotPrefix}-02-templates`)

  await page.getByTestId('template-card').first().click()
  await page.getByTestId('setup-name').waitFor({ state: 'visible', timeout: 20000 })
  await page.getByTestId('setup-name').fill(name)
  await page.getByTestId('setup-subdomain').fill(subdomain)
  await expect(page.getByTestId('setup-submit')).toBeEnabled({ timeout: 15000 })
  if (shotPrefix) await shot(page, scenarioId, `${shotPrefix}-03-setup`)
  await page.getByTestId('setup-submit').click()
  await expect(page.getByTestId(`my-site-admin-${subdomain}`)).toBeVisible({ timeout: 30000 })
  if (shotPrefix) await shot(page, scenarioId, `${shotPrefix}-04-created`)

  const site = await getSiteBySubdomain(subdomain)
  return { subdomain, name, site }
}

export async function deployWithMockCard(page, { scenarioId, subdomain, last4 = '1111', shotPrefix }) {
  await page.getByTestId(`my-site-admin-${subdomain}`).click()
  await page.getByTestId('admin-deploy').waitFor({ state: 'visible', timeout: 20000 })
  if (shotPrefix) await shot(page, scenarioId, `${shotPrefix}-05-admin`)

  await page.keyboard.press('Escape').catch(() => {})
  await page.getByTestId('admin-deploy').click()

  let phase = 'wait'
  await expect.poll(async () => {
    if (await page.getByTestId('pay-choose-card').isVisible().catch(() => false)) return (phase = 'method')
    if (await page.getByTestId('card-number').isVisible().catch(() => false)) return (phase = 'card')
    const st = (await getSiteBySubdomain(subdomain))?.status
    if (st === 'trial') return (phase = 'trial')
    return st || 'wait'
  }, { timeout: 45000 }).toMatch(/^(method|card|trial)$/)

  if (phase === 'trial') {
    if (shotPrefix) await shot(page, scenarioId, `${shotPrefix}-08-trial`)
    return
  }
  if (phase === 'method' || await page.getByTestId('pay-choose-card').isVisible().catch(() => false)) {
    if (shotPrefix) await shot(page, scenarioId, `${shotPrefix}-06-method`)
    await page.getByTestId('pay-choose-card').click()
    await page.getByTestId('card-number').waitFor({ state: 'visible', timeout: 20000 })
  }
  if (shotPrefix) await shot(page, scenarioId, `${shotPrefix}-07-card`)

  await fillCard(page, last4)
  await expect.poll(async () => (await getSiteBySubdomain(subdomain))?.status, {
    timeout: 45000,
  }).toBe('trial')
  if (shotPrefix) await shot(page, scenarioId, `${shotPrefix}-08-trial`)
}

export async function prepareSelfTrial(page, opts) {
  const created = await createSelfSite(page, opts)
  await deployWithMockCard(page, { ...opts, subdomain: created.subdomain, last4: opts.last4 || '1111' })
  await expect.poll(async () => (await getSiteBySubdomain(created.subdomain))?.status, {
    timeout: 20000,
  }).toBe('trial')
  const site = await getSiteBySubdomain(created.subdomain)
  return { ...created, site }
}

export async function openAdminBilling(page, subdomain) {
  await page.goto(`/s/${subdomain}/admin`)
  await page.getByTestId('admin-nav-billing.sub').waitFor({ state: 'visible', timeout: 20000 })
  await page.getByTestId('admin-nav-billing.sub').click()
}

export async function staffOpenSite(page, subdomain) {
  await loginAs(page, 'staff')
  await page.waitForURL(/\/platform/, { timeout: 20000 })
  await page.getByTestId('platform-nav-sites').click()
  await page.getByTestId('platform-search-input').fill(subdomain)
  await page.getByTestId('platform-search-submit').click()
  const row = page.getByTestId(`platform-site-${subdomain}`)
  await expect(row).toBeVisible({ timeout: 20000 })
  await row.click()
}

export { logout }
