/** 무료 체험 기간(일) */
export const TRIAL_DAYS = 14

/**
 * 체험 시작 시각 기준 — 종료일·첫 청구일 계산
 * next_billing_date = 체험 종료일 (deploy / 본사 trial 전환 공통)
 * @param {Date} [now]
 */
export function calcTrialWindow(now = new Date()) {
  const started = new Date(now)
  const ends = new Date(started.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
  return {
    trialStartedAt: started.toISOString(),
    trialEndsAt: ends.toISOString(),
    nextBillingDate: ends.toISOString().split('T')[0],
  }
}
