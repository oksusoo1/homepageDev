/**
 * 메인 플로우 스텝 (FLOW_STEP)
 * - code / label 은 고객·본사·뱃지에서 동일 사용
 * - 셀프: SELF_FLOW_STEPS 만 표시
 * - 대리: FLOW_STEPS 전체
 * - 견적 = deposit(선금) 단계에 포함 (별도 스텝 없음)
 *
 * DB 시드: docs/db/sql/migrations/013_flow_step.sql
 * 표시명 우선: 공통코드 FLOW_STEP → 여기 FLOW_STEP_LABEL
 */

/** @typedef {'intake'|'deposit'|'building'|'done_build'|'preview'|'balance'|'pay_method'|'trial'|'subscribed'|'suspended'} FlowStepCode */

/** @type {FlowStepCode[]} 대리 = 전체 순서 */
export const FLOW_STEPS = [
  'intake',
  'deposit',
  'building',
  'done_build',
  'preview',
  'balance',
  'pay_method',
  'trial',
  'subscribed',
  'suspended',
]

/** @type {FlowStepCode[]} 셀프 = 파란 스텝만 */
export const SELF_FLOW_STEPS = [
  'building',
  'done_build',
  'pay_method',
  'trial',
  'subscribed',
  'suspended',
]

/** 대리 전용 (빨간 스텝) */
export const MANAGED_ONLY_STEPS = new Set([
  'intake',
  'deposit',
  'preview',
  'balance',
])

/** 공통코드 미로드 시 라벨 */
export const FLOW_STEP_LABEL = {
  intake: '대리제작접수',
  deposit: '선금',
  building: '제작',
  done_build: '완료',
  preview: '검토',
  balance: '잔금',
  pay_method: '카드/계좌 등록',
  trial: '체험',
  subscribed: '구독',
  suspended: '정지',
}

/** 고객 안내 한 줄 */
export const FLOW_STEP_DESC = {
  intake: '문의가 접수되었습니다. 담당자가 연락드릴게요.',
  deposit: '견적·선금 안내를 진행합니다. 선금 확인 후 제작이 시작됩니다.',
  building: '사이트를 제작하고 있습니다.',
  done_build: '제작이 완료되었습니다. 검토 단계로 넘어갑니다.',
  preview: '미리보기를 확인해 주세요.',
  balance: '잔금을 납부해 주세요. 입금 신청 후 본사 확인을 기다립니다.',
  pay_method: '결제 수단을 등록하고 서비스를 시작해 주세요.',
  trial: '체험 이용 중입니다.',
  subscribed: '구독 이용 중입니다.',
  suspended: '이용이 정지된 상태입니다.',
}

/**
 * @param {'self'|'managed'|string|null|undefined} buildType
 * @returns {FlowStepCode[]}
 */
export function flowStepsFor(buildType) {
  return buildType === 'self' ? SELF_FLOW_STEPS : FLOW_STEPS
}

/**
 * @param {FlowStepCode|string} code
 * @param {'self'|'managed'|string|null|undefined} buildType
 */
export function isFlowStepVisible(code, buildType) {
  return flowStepsFor(buildType).includes(/** @type {FlowStepCode} */ (code))
}

/**
 * @param {FlowStepCode|string} code
 * @returns {string}
 */
export function flowStepLabel(code) {
  return FLOW_STEP_LABEL[code] || String(code || '—')
}

/**
 * @param {FlowStepCode|string} code
 * @returns {string}
 */
export function flowStepDesc(code) {
  return FLOW_STEP_DESC[code] || ''
}

/**
 * @param {FlowStepCode|string} code
 */
export function isManagedOnlyStep(code) {
  return MANAGED_ONLY_STEPS.has(/** @type {FlowStepCode} */ (code))
}

/**
 * @param {FlowStepCode|string} code
 * @param {'self'|'managed'|string|null|undefined} buildType
 */
export function getFlowStepIndex(code, buildType = 'managed') {
  const steps = flowStepsFor(buildType)
  const idx = steps.indexOf(/** @type {FlowStepCode} */ (code))
  return idx === -1 ? 0 : idx
}

/**
 * 기존 DB 사실 → FLOW_STEP (대리)
 * inquiries / sites / subscriptions 컬럼은 유지, 표시만 통일
 *
 * @param {object|null|undefined} inquiry
 * @param {{ site?: object|null, subscription?: object|null, finalPending?: boolean }} [ctx]
 * @returns {FlowStepCode}
 */
export function resolveManagedFlowStep(inquiry, ctx = {}) {
  const { site = null, subscription = null, finalPending = false } = ctx
  const sub = subscription || site?.subscriptions?.[0] || null

  if (site?.status === 'suspended') return 'suspended'
  if (sub?.status === 'active') return 'subscribed'
  if (sub?.status === 'trial') return 'trial'

  if (!inquiry) return 'intake'

  const st = inquiry.status
  const finalPaid = !!inquiry.final_paid_at

  if (st === 'done') {
    if (sub?.status === 'active') return 'subscribed'
    if (sub?.status === 'trial') return 'trial'
    return 'pay_method'
  }
  if (st === 'approved' || finalPaid) return 'pay_method'

  if (st === 'review') {
    if (finalPending) return 'balance'
    return 'preview'
  }

  if (st === 'building') {
    if (site?.status === 'review' || site?.status === 'published') return 'done_build'
    return 'building'
  }

  if (st === 'reviewing') return 'deposit'
  if (st === 'received') return 'intake'

  return 'intake'
}

/**
 * 셀프 → FLOW_STEP
 * @param {object|null|undefined} site
 * @param {{ subscription?: object|null }} [ctx]
 * @returns {FlowStepCode}
 */
export function resolveSelfFlowStep(site, ctx = {}) {
  const sub = ctx.subscription || site?.subscriptions?.[0] || null

  if (site?.status === 'suspended' || site?.status === 'cancelled') return 'suspended'
  if (sub?.status === 'active') return 'subscribed'
  if (sub?.status === 'trial') return 'trial'
  if (site?.status === 'published') return 'pay_method'
  if (site?.status === 'review') return 'done_build'
  return 'building'
}

/**
 * 사장님 카드「다음」한 줄 (형식 통일: `다음: …`)
 * @param {FlowStepCode|string} step
 * @param {'self'|'managed'|string} buildType
 */
export function customerNextLine(step, buildType) {
  const self = buildType === 'self'
  const lines = {
    intake: '접수가 완료되었습니다. 담당자 연락을 기다려 주세요.',
    deposit: '견적·선금 안내를 기다려 주세요.',
    building: self
      ? '디자인 모드에서 꾸민 뒤 배포해 주세요.'
      : '본사에서 제작 중입니다.',
    done_build: self
      ? '배포 준비가 되면 배포·운영에서 진행해 주세요.'
      : '제작이 끝났습니다. 검토 안내를 기다려 주세요.',
    preview: '미리보기를 확인해 주세요.',
    balance: '잔금을 납부해 주세요.',
    pay_method: '결제 수단을 등록하고 서비스를 시작해 주세요.',
    trial: '체험 이용 중입니다. 결제 수단을 등록하면 구독으로 이어집니다.',
    subscribed: '구독 이용 중입니다.',
    suspended: '정지를 해제하려면 결제·구독을 확인해 주세요.',
  }
  return `다음: ${lines[step] || flowStepDesc(step) || '진행 상황을 확인해 주세요.'}`
}

/**
 * 본사 제작문의 — 지금 할 일 1개
 * @param {FlowStepCode|string} flowStep
 * @param {object} inquiry
 * @param {{ linkedSite?: object|null, finalPending?: boolean }} [ctx]
 * @returns {{ key: string, label: string|null, hint?: string }}
 */
export function resolveHqInquiryAction(flowStep, inquiry, ctx = {}) {
  const { linkedSite = null, finalPending = false } = ctx

  if (flowStep === 'intake') {
    return {
      key: 'start_deposit',
      label: '다음: 선금(견적) 진행',
      hint: '연락·범위 확인 후 견적 금액을 넣고 진행하세요.',
    }
  }
  if (flowStep === 'deposit') {
    if (!inquiry?.dev_fee_total) {
      return { key: 'need_fee', label: null, hint: '총 개발비(견적)를 저장하세요.' }
    }
    if (!inquiry?.down_paid_at) {
      return { key: 'confirm_deposit', label: '선금 확인', hint: '견적은 선금 단계에 포함됩니다.' }
    }
  }
  if (flowStep === 'building') {
    if (!linkedSite) {
      return {
        key: 'create_site',
        label: '사이트 생성',
        hint: '이 문의에 사이트가 없습니다. (구 데이터) 가입 회원으로 개설하세요.',
      }
    }
    return { key: 'open_editor', label: '에디터에서 제작', hint: '에디터에서 제작한 뒤 검수용 공개하세요.' }
  }
  if (flowStep === 'done_build') {
    return { key: 'open_preview', label: '검수용 공개', hint: '고객 검토 단계로 넘기세요.' }
  }
  if (flowStep === 'preview') {
    return {
      key: finalPending ? 'confirm_balance' : 'wait_balance',
      label: finalPending ? '잔금 확인' : null,
      hint: finalPending
        ? '고객이 잔금 입금을 신청했습니다.'
        : '고객이 미리보기·잔금 결제 중입니다.',
    }
  }
  if (flowStep === 'balance') {
    return { key: 'confirm_balance', label: '잔금 확인', hint: '통장 확인 후 잔금을 확정하세요.' }
  }
  if (['pay_method', 'trial', 'subscribed', 'suspended'].includes(flowStep)) {
    return {
      key: linkedSite ? 'view_site' : 'none',
      label: linkedSite ? '사이트 확인' : null,
      hint: flowStepLabel(flowStep),
    }
  }
  return { key: 'none', label: null }
}

/**
 * 본사에서 에디터 진입 가능 여부
 * - 대리: 선금 확인 후(building~)만
 * - 직접: 참고용으로 항상 가능
 */
export function canOpenHqEditor(buildType, flowStep) {
  if (buildType !== 'managed') return true
  const idx = getFlowStepIndex(flowStep, 'managed')
  const buildingIdx = getFlowStepIndex('building', 'managed')
  return idx >= buildingIdx
}
