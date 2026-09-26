import { test, expect } from '@playwright/test'
import { createSelfSite } from './helpers/flow.js'
import { logout } from './helpers/auth.js'
import { getSiteBySubdomain } from './helpers/db.js'
import { recordScenario, addDbCheck } from './helpers/report.js'
import { shot } from './helpers/shot.js'

const ID = 'S7'

test('S7 제작 중(building) 비로그인 공개 범위', async ({ page, request }) => {
  recordScenario({ id: ID })
  const { subdomain, name } = await createSelfSite(page, {
    scenarioId: ID,
    scenarioKey: 's7',
    shotPrefix: 's7',
  })
  recordScenario({ id: ID, site: subdomain })

  const site = await getSiteBySubdomain(subdomain)
  addDbCheck(ID, 'sites.status', site.status)
  expect(site.status).toBe('building')

  await logout(page)
  await page.goto(`/s/${subdomain}`)
  await page.getByTestId('site-gate-blocked').waitFor({ state: 'visible', timeout: 20000 })
  await expect(page.getByText('제작 중입니다')).toBeVisible()
  await shot(page, ID, 's7-05-gate')

  const res = await request.get(`/s/${subdomain}`)
  const html = await res.text()
  const leaked = html.includes(name) || /heroTitle|"hero"/.test(html)
  addDbCheck(ID, 'gate_visible', true)
  addDbCheck(ID, 'html_contains_body', leaked)

  if (leaked) {
    recordScenario({
      id: ID,
      knownIssue: '화면은 차단되나 페이지 소스(RSC)에 본문이 포함됨 — 보안 ④단계 대상',
    })
  }
})
