import { test, expect } from '@playwright/test'
import { loginAs, logout } from './helpers/auth.js'
import { prepareSelfTrial } from './helpers/flow.js'
import { getSiteBySubdomain, listPosts } from './helpers/db.js'
import { recordScenario, addDbCheck } from './helpers/report.js'
import { shot } from './helpers/shot.js'

const ID = 'S15'

function assertNoLeak(html, needles, where) {
  for (const n of needles) {
    expect(html.includes(n), `${where}에 비밀 본문/제목 누수: ${n}`).toBe(false)
  }
}

async function writeSecretQna(page, subdomain, { name, title, body }) {
  await page.goto(`/s/${subdomain}/board/qna/write`)
  await page.getByTestId('board-author').waitFor({ state: 'visible', timeout: 20000 })
  await page.getByTestId('board-author').fill(name)
  await page.getByTestId('board-phone').fill('010-0000-0000')
  await page.getByPlaceholder('you@example.com').fill('secret@test.local')
  await page.getByTestId('board-title').fill(title)
  await page.getByTestId('board-content').fill(body)
  await page.getByTestId('board-private').check()
  await page.getByTestId('board-submit').click()
  await page.waitForURL(url => {
    const u = new URL(url)
    return u.pathname.replace(/\/$/, '') === `/s/${subdomain}/board/qna`
  }, { timeout: 20000 })
}

test('S15 비밀글 — 비로그인 안내 · 타인 차단 · 사장님·작성자 원문', async ({ page, request, context }) => {
  recordScenario({ id: ID })
  const { subdomain } = await prepareSelfTrial(page, {
    scenarioId: ID,
    scenarioKey: 's15',
    shotPrefix: 's15',
  })
  recordScenario({ id: ID, site: subdomain })

  await page.keyboard.press('Escape').catch(() => {})
  await page.getByRole('button', { name: '확인' }).click({ timeout: 3000 }).catch(() => {})
  await logout(page)

  const titleA = `비밀제목A-${Date.now()}`
  const bodyA = `비밀본문A-${Date.now()}-LEAK`
  await writeSecretQna(page, subdomain, { name: '손님A', title: titleA, body: bodyA })
  await expect(page.getByTestId('secret-post-notice')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('사장님만 볼 수 있어요')).toBeVisible()
  await shot(page, ID, 's15-01-notice')

  const site = await getSiteBySubdomain(subdomain)
  let postA
  await expect.poll(async () => {
    const posts = await listPosts(site.site_id)
    postA = posts.find(p => p.title === titleA)
    return postA?.is_private || false
  }, { timeout: 20000 }).toBe(true)
  addDbCheck(ID, 'anon_private', true)

  await expect(page.getByText('🔒 비밀글입니다').first()).toBeVisible()
  await expect(page.getByText(titleA)).toHaveCount(0)
  await page.goto(`/s/${subdomain}/board/qna/${postA.post_id}`)
  await expect(page.getByText('🔒 비밀글입니다')).toBeVisible()
  await expect(page.getByText(bodyA)).toHaveCount(0)

  const listHtml = await (await request.get(`/s/${subdomain}/board/qna`)).text()
  const detailHtml = await (await request.get(`/s/${subdomain}/board/qna/${postA.post_id}`)).text()
  assertNoLeak(listHtml, [titleA, bodyA], '목록 RSC')
  assertNoLeak(detailHtml, [titleA, bodyA], '상세 RSC')
  addDbCheck(ID, 'anon_rsc_clean', true)

  await loginAs(page, 'a')
  await page.goto(`/s/${subdomain}/board/qna/${postA.post_id}`)
  await expect(page.getByRole('heading', { name: titleA })).toBeVisible({ timeout: 20000 })
  await expect(page.getByText(bodyA)).toBeVisible()
  await shot(page, ID, 's15-02-owner')
  addDbCheck(ID, 'owner_can_read', true)

  await logout(page)
  await loginAs(page, 'b')
  const titleB = `비밀제목B-${Date.now()}`
  const bodyB = `비밀본문B-${Date.now()}-LEAK`
  await writeSecretQna(page, subdomain, { name: '손님B', title: titleB, body: bodyB })

  let postB
  await expect.poll(async () => {
    const posts = await listPosts(site.site_id)
    postB = posts.find(p => p.title === titleB)
    return postB?.post_id || null
  }, { timeout: 20000 }).toBeTruthy()
  addDbCheck(ID, 'b_author_auth', !!postB.author_auth_id)

  await page.goto(`/s/${subdomain}/board/qna/${postB.post_id}`)
  await expect(page.getByText(bodyB)).toBeVisible({ timeout: 15000 })
  await shot(page, ID, 's15-03-author-b')

  await context.clearCookies()
  const other = await request.get(`/s/${subdomain}/board/qna/${postB.post_id}`)
  const otherHtml = await other.text()
  assertNoLeak(otherHtml, [titleB, bodyB], '비로그인 B글 RSC')
  addDbCheck(ID, 'b_hidden_to_anon', true)
})
