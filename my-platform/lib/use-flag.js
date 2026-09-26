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

/** 쓰기(softDelete/softRestore)는 lib/use-flag-write.js (server-only) */
