import { baseUrl, loadEnv } from './env.js'

loadEnv()

/** 자기 사이트만 배치. 다른 구독은 건드리지 않는다. */
export async function runBillingBatch({ asOf, onlySiteId }) {
  if (!onlySiteId) throw new Error('runBillingBatch: onlySiteId 필수')
  const secret = process.env.CRON_SECRET
  if (!secret) throw new Error('CRON_SECRET 이 없습니다.')

  const res = await fetch(`${baseUrl()}/api/cron/billing`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cron-secret': secret,
    },
    body: JSON.stringify({ asOf, siteIds: [onlySiteId] }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`배치 ${res.status}: ${body.error || JSON.stringify(body)}`)
  }
  return body
}
