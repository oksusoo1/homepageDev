'use server'

import {
  loadAuthBar,
  resolvePostLoginPath,
  loadCommonCodesRows,
  loadTemplateList,
  loadCustomerSelf,
  checkSubdomainTaken,
} from '@/lib/server/reads'

function fail(error) {
  return { ok: false, error: error || '조회에 실패했습니다.' }
}

export async function loadAuthBarAction(siteCode = '') {
  return loadAuthBar(siteCode)
}

export async function getPostLoginPathAction() {
  return resolvePostLoginPath()
}

export async function loadCommonCodesAction() {
  return loadCommonCodesRows()
}

export async function loadTemplateListAction() {
  return loadTemplateList()
}

export async function loadCustomerSelfAction() {
  return loadCustomerSelf()
}

export async function checkSubdomainTakenAction(subdomain) {
  const v = String(subdomain || '').trim().toLowerCase()
  if (!v) return fail('주소를 입력해 주세요.')
  return checkSubdomainTaken(v)
}
