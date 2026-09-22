/**
 * 공통코드 조회/캐시
 * DB: common_codes (group_code + code)
 * 코드값(code)은 불변 · 표시명(label)만 관리화면에서 변경
 */

import { supabase } from '@/lib/supabase'
import { onlyActive } from '@/lib/use-flag'

/** @type {{ groups: string[], byGroup: Record<string, object[]>, loadedAt: number } | null} */
let cache = null

export function clearCommonCodeCache() {
  cache = null
}

/**
 * @param {{ force?: boolean }} [opts]
 */
export async function loadCommonCodes({ force = false } = {}) {
  if (!force && cache) return cache

  const { data: codes, error } = await onlyActive(
    supabase
      .from('common_codes')
      .select('*')
      .order('group_code')
      .order('sort_order')
  )
  if (error) throw error

  const byGroup = {}
  for (const c of codes || []) {
    const gc = c.group_code
    if (!gc) continue
    if (!byGroup[gc]) byGroup[gc] = []
    byGroup[gc].push(c)
  }

  const groups = Object.keys(byGroup).sort()
  cache = { groups, byGroup, loadedAt: Date.now() }
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
  PAYMENT_METHOD: { card: '#22c55e', manual: '#f59e0b' },
  OTP_TYPE: { domain_setup: '#8b5cf6', dev_fee: '#f59e0b', extra: '#6b7280' },
  OTP_STATUS: { unpaid: '#64748b', pending_confirm: '#f59e0b', paid: '#22c55e' },
  BILLING_STATUS: { unpaid: '#f59e0b', paid: '#22c55e', overdue: '#ef4444' },
  FLOW_STEP: {
    intake: '#b45309', deposit: '#b45309',
    building: '#2563eb',
    preview: '#b45309', balance: '#b45309',
    pay_method: '#2563eb', trial: '#2563eb',
    subscribed: '#2563eb', suspended: '#2563eb',
  },
  TICKET_STATUS: { open: '#f59e0b', in_progress: '#60a5fa', resolved: '#22c55e' },
  TICKET_PRIORITY: { low: '#60a5fa', normal: '#60a5fa', high: '#f59e0b', urgent: '#ef4444' },
  CUSTOMER_STATUS: { active: '#22c55e', suspended: '#f59e0b', withdrawn: '#ef4444' },
}

export function codeColor(groupCode, code, fallback = '#6b7280') {
  return COLORS[groupCode]?.[code] || fallback
}

/** React용 — 로드 후 label */
export async function getCodeLabelAsync(groupCode, code, fallback) {
  await loadCommonCodes()
  return codeLabel(groupCode, code, fallback)
}
