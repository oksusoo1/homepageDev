/**
 * 공통코드 조회/캐시
 * DB: code_groups + common_codes
 * 코드값(code)은 불변 · 표시명(label)만 관리화면에서 변경
 */

import { supabase } from '@/lib/supabase'
import { onlyActive } from '@/lib/use-flag'

/** @type {{ groups: object[], byGroup: Record<string, object[]>, loadedAt: number } | null} */
let cache = null

export function clearCommonCodeCache() {
  cache = null
}

/**
 * @param {{ force?: boolean }} [opts]
 */
export async function loadCommonCodes({ force = false } = {}) {
  if (!force && cache) return cache

  const { data: groups, error: gErr } = await onlyActive(
    supabase.from('code_groups').select('*').order('group_code')
  )
  if (gErr) throw gErr

  const { data: codes, error: cErr } = await onlyActive(
    supabase
      .from('common_codes')
      .select('*, code_groups(group_code)')
      .order('sort_order')
  )
  if (cErr) throw cErr

  const byGroup = {}
  for (const g of groups || []) byGroup[g.group_code] = []
  for (const c of codes || []) {
    const gc = c.code_groups?.group_code
    if (!gc) continue
    if (!byGroup[gc]) byGroup[gc] = []
    byGroup[gc].push(c)
  }

  cache = { groups: groups || [], byGroup, loadedAt: Date.now() }
  return cache
}

/** 동기 조회 (캐시 없으면 code 그대로) */
export function codeLabel(groupCode, code, fallback) {
  if (code == null || code === '') return fallback ?? '—'
  const list = cache?.byGroup?.[groupCode]
  const hit = list?.find(c => c.code === code && c.use_flag !== 0)
  return hit?.label || fallback || String(code)
}

export function codesInGroup(groupCode) {
  return (cache?.byGroup?.[groupCode] || []).filter(c => c.use_flag !== 0)
}

/** 뱃지 색 (표시용 — DB 아님) */
const COLORS = {
  BUILD_TYPE: { self: '#60a5fa', managed: '#f59e0b' },
  SITE_STATUS: {
    draft: '#f59e0b', review: '#8b5cf6', published: '#22c55e',
    suspended: '#ef4444', cancelled: '#6b7280',
  },
  SUB_STATUS: {
    pending: '#64748b', trial: '#f59e0b', active: '#22c55e',
    paused: '#f59e0b', cancelled: '#6b7280',
  },
  PAYMENT_METHOD: { card: '#22c55e', manual: '#f59e0b' },
  OTP_TYPE: { domain_setup: '#8b5cf6', dev_fee: '#f59e0b', extra: '#6b7280' },
  OTP_STATUS: { unpaid: '#64748b', pending_confirm: '#f59e0b', paid: '#22c55e' },
  BILLING_STATUS: { unpaid: '#f59e0b', paid: '#22c55e', overdue: '#ef4444' },
  INQUIRY_STATUS: {
    received: '#60a5fa', reviewing: '#a78bfa', building: '#f59e0b',
    review: '#f472b6', approved: '#34d399', done: '#22c55e',
  },
  TICKET_STATUS: { open: '#f59e0b', in_progress: '#60a5fa', resolved: '#22c55e' },
  TICKET_PRIORITY: { low: '#60a5fa', normal: '#60a5fa', high: '#f59e0b', urgent: '#ef4444' },
  CUSTOMER_STATUS: { active: '#22c55e', suspended: '#f59e0b', withdrawn: '#ef4444' },
  DEPLOY_STATUS: {
    pending: '#64748b', building: '#f59e0b', live: '#22c55e', failed: '#ef4444',
  },
}

export function codeColor(groupCode, code, fallback = '#6b7280') {
  return COLORS[groupCode]?.[code] || fallback
}

/** React용 — 로드 후 label */
export async function getCodeLabelAsync(groupCode, code, fallback) {
  await loadCommonCodes()
  return codeLabel(groupCode, code, fallback)
}
