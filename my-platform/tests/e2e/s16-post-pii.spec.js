import { test, expect } from '@playwright/test'
import { logout } from './helpers/auth.js'
import { prepareSelfTrial } from './helpers/flow.js'
import { getSiteBySubdomain, listPosts } from './helpers/db.js'
import { recordScenario, addDbCheck } from './helpers/report.js'
import { shot } from './helpers/shot.js'

const ID = 'S16'

test('S16 공개 문의 글의 전화·이메일은 방문자 응답에 없음', async ({ page, request }) => {
  recordScenario({ id: ID })
  const { subdomain } = await prepareSelfTrial(page, {
    scenarioId: ID,
    scenarioKey: 's16',
    shotPrefix: 's16',
  })
  recordScenario({ id: ID, site: subdomain })

  await page.keyboard.press('Escape').catch(() => {})
  await page.getByRole('button', { name: '확인' }).click({ timeout: 3000 }).catch(() => {})
  await logout(page)

  const stamp = Date.now()
  const title = `공개문의-${stamp}`
  const body = `본문은공개-${stamp}`
  const phone = `010-5555-${String(stamp).slice(-4)}`
  const email = `pii-${stamp}@hide.test`

  await page.goto(`/s/${subdomain}/board/qna/write`)
  await page.getByTestId('board-author').waitFor({ state: 'visible', timeout: 20000 })
  await page.getByTestId('board-author').fill('문의객')
  await page.getByTestId('board-phone').fill(phone)
  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByTestId('board-title').fill(title)
  await page.getByTestId('board-content').fill(body)
  await page.getByTestId('board-submit').click()
  await page.waitForURL(url => {
    const p = new URL(url).pathname.replace(/\/$/, '')
    return p === `/s/${subdomain}/board/qna`
  }, { timeout: 20000 })

  const site = await getSiteBySubdomain(subdomain)
  let post
  await expect.poll(async () => {
    const posts = await listPosts(site.site_id)
    post = posts.find(p => p.title === title)
    return post?.post_id || null
  }, { timeout: 20000 }).toBeTruthy()
  addDbCheck(ID, 'db_phone', post.phone)
  addDbCheck(ID, 'db_email', post.email)

  await page.goto(`/s/${subdomain}/board/qna/${post.post_id}`)
  await expect(page.getByText(body)).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(phone)).toHaveCount(0)
  await expect(page.getByText(email)).toHaveCount(0)
  await shot(page, ID, 's16-01-detail')

  const html = await (await request.get(`/s/${subdomain}/board/qna/${post.post_id}`)).text()
  expect(html.includes(phone), 'RSC에 전화').toBe(false)
  expect(html.includes(email), 'RSC에 이메일').toBe(false)
  addDbCheck(ID, 'rsc_clean', true)
})
