import { test, expect } from '@playwright/test'
import { pickSiteOwnerPatch } from '../../lib/site-edit.js'
import { recordScenario, addDbCheck } from './helpers/report.js'

const ID = 'S9'

test('S9 금지 필드는 pickSiteOwnerPatch에서 무시', async () => {
  recordScenario({ id: ID, title: '금지 필드 무시' })

  const r = pickSiteOwnerPatch({
    name: '허용된 이름',
    status: 'subscribed',
    build_type: 'managed',
    customer_id: 'spoof',
    template_id: 'spoof',
    subdomain: 'hacked',
    domain: 'evil.com',
    content: { hero: { title: 'ok' } },
  })

  expect(r.ok, '허용 필드만 있으면 ok').toBe(true)
  expect(r.patch.name).toBe('허용된 이름')
  expect(r.patch.content?.hero?.title).toBe('ok')
  expect(r.patch.status).toBeUndefined()
  expect(r.patch.build_type).toBeUndefined()
  expect(r.patch.customer_id).toBeUndefined()
  expect(r.patch.template_id).toBeUndefined()
  expect(r.patch.subdomain).toBeUndefined()
  expect(r.patch.domain).toBeUndefined()

  addDbCheck(ID, 'patch_keys', Object.keys(r.patch).sort().join(','))
  addDbCheck(ID, 'status_dropped', r.patch.status == null)
})
