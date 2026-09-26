import { ACCOUNTS, e2ePassword } from './env.js'

export { ACCOUNTS }

export async function login(page, email, password = e2ePassword()) {
  await page.goto('/login')
  try {
    await page.getByTestId('login-email').waitFor({ state: 'visible', timeout: 5000 })
  } catch {
    await logout(page)
    await page.goto('/login')
    await page.getByTestId('login-email').waitFor({ state: 'visible', timeout: 20000 })
  }
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL(url => {
    const p = new URL(url).pathname
    return p === '/my' || p === '/platform'
  }, { timeout: 30000 })
}

export async function loginAs(page, who) {
  const email = ACCOUNTS[who] || who
  await login(page, email)
}

export async function logout(page) {
  await page.keyboard.press('Escape').catch(() => {})
  await page.getByRole('button', { name: '확인' }).click({ timeout: 2000 }).catch(() => {})
  const btn = page.getByTestId('auth-logout')
  try {
    await btn.waitFor({ state: 'visible', timeout: 8000 })
    await btn.click({ timeout: 5000 })
    await page.waitForURL(/\/login/, { timeout: 15000 })
    return
  } catch { /* 쿠키 정리로 폴백 */ }
  await page.context().clearCookies()
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear() } catch { /* ignore */ }
  })
  await page.goto('/login')
}

export async function acceptDialogs(page) {
  page.on('dialog', d => d.accept())
}
