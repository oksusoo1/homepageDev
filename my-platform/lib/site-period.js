/**
 * 사이트 체험/운영 기간 표시용
 * - 체험 N/14 + D-남은일
 * - 운영 N일 (trial 종료 다음날부터)
 */

const DAY_MS = 24 * 60 * 60 * 1000

function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** 일차(1-based): from~to 사이 날짜 수 기준 */
function dayIndex(from, to) {
  const a = startOfLocalDay(from).getTime()
  const b = startOfLocalDay(to).getTime()
  return Math.floor((b - a) / DAY_MS) + 1
}

function daysBetweenCeil(from, to) {
  const a = startOfLocalDay(from).getTime()
  const b = startOfLocalDay(to).getTime()
  return Math.ceil((b - a) / DAY_MS)
}

/**
 * @param {object} site  (sites.status = FLOW_STEP 기준)
 * @param {Date} [now]
 * @returns {{
 *   kind: 'trial'|'ops'|'expired'|'none',
 *   label: string,
 *   subLabel: string|null,
 *   color: string,
 *   trialDay: number|null,
 *   trialTotal: number|null,
 *   daysLeft: number|null,
 *   opDay: number|null,
 *   detail: string,
 * }}
 */
export function getSitePeriodInfo(site, now = new Date()) {
  const trialStart = site?.trial_started_at ? new Date(site.trial_started_at) : null
  const trialEnds = site?.trial_ends_at ? new Date(site.trial_ends_at) : null

  let trialTotal = null
  let trialDay = null
  let daysLeft = null
  let opDay = null

  if (trialStart && trialEnds) {
    trialTotal = Math.max(1, Math.round((startOfLocalDay(trialEnds) - startOfLocalDay(trialStart)) / DAY_MS))
    daysLeft = daysBetweenCeil(now, trialEnds)
    trialDay = Math.min(trialTotal, Math.max(1, dayIndex(trialStart, now)))
  }

  const inTrial =
    trialEnds &&
    daysLeft != null &&
    daysLeft > 0 &&
    site?.status === 'trial'

  if (inTrial) {
    return {
      kind: 'trial',
      label: `체험 ${trialDay}/${trialTotal}`,
      subLabel: `D-${daysLeft}`,
      color: '#f59e0b',
      trialDay,
      trialTotal,
      daysLeft,
      opDay: null,
      detail: `체험 ${trialDay}일차 / ${trialTotal}일 · 남은 ${daysLeft}일 · 종료 ${trialEnds.toLocaleDateString('ko-KR')}`,
    }
  }

  const trialOver = trialEnds && daysLeft != null && daysLeft <= 0
  if (trialOver && (site?.status === 'suspended' || site?.status === 'trial')) {
    return {
      kind: 'expired',
      label: site?.status === 'suspended' ? '만료·정지' : '만료',
      subLabel: null,
      color: '#ef4444',
      trialDay,
      trialTotal,
      daysLeft,
      opDay: null,
      detail: `체험 종료 ${trialEnds.toLocaleDateString('ko-KR')} · 사이트 ${site?.status}`,
    }
  }

  // 유료/운영: trial 끝난 뒤 subscribed
  if (trialEnds && daysLeft != null && daysLeft <= 0 && site?.status === 'subscribed') {
    const opsStart = new Date(trialEnds)
    opsStart.setDate(opsStart.getDate() + 1)
    if (now < startOfLocalDay(opsStart)) {
      opDay = 1
    } else {
      opDay = Math.max(1, dayIndex(opsStart, now))
    }
    return {
      kind: 'ops',
      label: `운영 ${opDay}일`,
      subLabel: '유료',
      color: '#22c55e',
      trialDay,
      trialTotal,
      daysLeft,
      opDay,
      detail: `운영 ${opDay}일차 · 체험종료 ${trialEnds.toLocaleDateString('ko-KR')}`,
    }
  }

  if (site?.status === 'subscribed' && !trialStart) {
    return {
      kind: 'ops',
      label: '운영중',
      subLabel: '유료',
      color: '#22c55e',
      trialDay: null,
      trialTotal: null,
      daysLeft: null,
      opDay: null,
      detail: '체험 기록 없음',
    }
  }

  return {
    kind: 'none',
    label: '—',
    subLabel: null,
    color: '#475569',
    trialDay: null,
    trialTotal: null,
    daysLeft: null,
    opDay: null,
    detail: '체험/운영 기간 해당 없음',
  }
}
