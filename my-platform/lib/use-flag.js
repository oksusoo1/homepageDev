/**
 * Soft delete: use_flag
 * 1 = 사용(살아있음) · 0 = 삭제
 * 업무 상태는 status / 데이터 사용여부는 use_flag
 */

export const USE_FLAG_ON = 1
export const USE_FLAG_OFF = 0

/** 조회용 — 사용 중인 행만 */
export function onlyActive(query) {
  return query.eq('use_flag', USE_FLAG_ON)
}

/**
 * Soft delete
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} table
 * @param {string} idColumn  예: 'site_id'
 * @param {string} id
 */
export async function softDelete(supabase, table, idColumn, id) {
  const patch = { use_flag: USE_FLAG_OFF }
  // updated_at 있는 테이블은 갱신
  if (['customers', 'staff', 'sites', 'inquiries', 'subscriptions', 'support_tickets'].includes(table)) {
    patch.updated_at = new Date().toISOString()
  }
  const { error } = await supabase.from(table).update(patch).eq(idColumn, id)
  if (error) throw error
}

/** Soft delete 복구 */
export async function softRestore(supabase, table, idColumn, id) {
  const patch = { use_flag: USE_FLAG_ON }
  if (['customers', 'staff', 'sites', 'inquiries', 'subscriptions', 'support_tickets'].includes(table)) {
    patch.updated_at = new Date().toISOString()
  }
  const { error } = await supabase.from(table).update(patch).eq(idColumn, id)
  if (error) throw error
}
