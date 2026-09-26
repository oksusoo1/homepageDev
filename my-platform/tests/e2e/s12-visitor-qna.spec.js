import { test, expect } from '@playwright/test'
import { prepareSelfTrial } from './helpers/flow.js'
import { getSiteBySubdomain, listPosts } from './helpers/db.js'
import { recordScenario, addDbCheck } from './helpers/report.js'
import { shot } from './helpers/shot.js'

const ID = 'S12'

test('S12 방문자가 공개 문의 게시판에 글 작성 — author_type=user', async ({ page }) => {
  recordScenario({ id: ID })
  const { subdomain } = await prepareSelfTrial(page, {
    scenarioId: ID,
    scenarioKey: 's12',
    shotPrefix: 's12',
  })
  recordScenario({ id: ID, site: subdomain })

  await page.keyboard.press('Escape').catch(() => {})
  await page.getByRole('button', { name: '확인' }).click({ timeout: 3000 }).catch(() => {})
  await page.context().clearCookies()
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear() } catch { /* ignore */ }
  })

  const title = `방문 문의 ${Date.now()}`
  await page.goto(`/s/${subdomain}/board/qna/write`)
  await page.getByTestId('board-author').waitFor({ state: 'visible', timeout: 20000 })
  await page.getByTestId('board-author').fill('방문객')
  await page.getByPlaceholder('010-0000-0000').fill('010-0000-0000')
  await page.getByPlaceholder('you@example.com').fill('visitor@test.local')
  await page.getByTestId('board-title').fill(title)
  await page.getByTestId('board-content').fill('비로그인 문의입니다')
  await page.getByTestId('board-submit').click()
  await page.waitForURL(url => {
    const p = new URL(url).pathname.replace(/\/$/, '')
    return p === `/s/${subdomain}/board/qna`
  }, { timeout: 20000 })
  await shot(page, ID, 's12-05-written')

  const site = await getSiteBySubdomain(subdomain)
  let mine
  await expect.poll(async () => {
    const posts = await listPosts(site.site_id)
    mine = posts.find(p => p.title === title)
    return mine?.author_type || null
  }, { timeout: 20000 }).toBe('user')
  addDbCheck(ID, 'author_type', mine?.author_type)
  addDbCheck(ID, 'title', mine?.title)
})
