import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs'
import { dirname, relative, resolve } from 'path'

const TITLES = {
  S1: 'A: 셀프 사이트 생성 → 카드(목업) 등록 → 서비스 시작',
  S2: 'A: 체험 중 카드 재등록',
  S3: '배치 asOf=체험종료일+1',
  S4: 'A: 해지 예약 → 배치 asOf=해지예정일+1 → 카드 재구독',
  S5: '대리: B 의뢰 → staff 견적 → B 선금 입금했어요 → staff 선금 확인',
  S6: '권한 차단',
  S7: '공개 범위 (제작 중 비로그인)',
  S8: 'A: 에디터 내용 저장',
  S9: '편집 요청에 금지 필드 섞음',
  S10: '/setup 주소 검사',
  S11: 'B가 A 사이트 에디터·게시판 관리 접근',
  S12: '방문자가 공개 문의 게시판에 글 작성',
  S13: '신규 가입 customers 행',
  S14: '유료 구독 중 탈퇴 → 배치 확정',
}

function scenarioIdFromTitle(title) {
  const m = String(title || '').match(/\b(S\d+)\b/)
  return m ? m[1] : title
}

function sortScenarioIds(ids) {
  return [...ids].sort((a, b) => {
    const na = String(a).match(/^S(\d+)$/)
    const nb = String(b).match(/^S(\d+)$/)
    if (na && nb) return Number(na[1]) - Number(nb[1])
    if (na) return -1
    if (nb) return 1
    return String(a).localeCompare(String(b), 'ko')
  })
}

function scenarioTitle(id, rec) {
  return TITLES[id] || rec?.title || id
}

function loadRun() {
  const p = resolve('test-results/e2e-run.json')
  if (!existsSync(p)) return {}
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return {} }
}

function loadMeta() {
  const run = loadRun()
  const p = process.env.E2E_META_FILE || run.E2E_META_FILE || 'test-results/e2e-meta.json'
  if (!existsSync(p)) return { scenarios: {} }
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return { scenarios: {} } }
}

function statusLabel(s) {
  if (s === 'passed') return '통과'
  if (s === 'known_issue') return '알려진 이슈'
  if (s === 'failed') return '실패'
  if (s === 'skipped') return '스킵'
  return s || '미실행'
}

class MdReporter {
  constructor() {
    this.results = {}
  }

  onTestEnd(test, result) {
    const title = test.title
    const id = scenarioIdFromTitle(title)
    this.results[id] = {
      title,
      status: result.status === 'passed' ? 'passed' : result.status,
      error: result.error?.message || (result.errors || []).map(e => e.message).filter(Boolean).join('\n'),
      duration: result.duration,
    }
  }

  onEnd() {
    const run = loadRun()
    const meta = loadMeta()
    const stamp = process.env.E2E_RUN_STAMP || run.E2E_RUN_STAMP
      || new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(new Date()).replace(/[-:]/g, '').replace(', ', '_')
    const docPath = process.env.E2E_DOC_PATH || run.E2E_DOC_PATH || `docs/테스트결과/${stamp}.md`
    const baseUrl = process.env.E2E_BASE_URL || run.E2E_BASE_URL || meta.baseUrl || 'http://localhost:3000'
    const started = meta.startedAt || ''

    const lines = []
    lines.push(`# E2E 테스트 결과 — ${stamp}`)
    lines.push('')
    lines.push(`- 실행 일시: ${started || new Date().toISOString()} (KST 스탬프 ${stamp})`)
    lines.push(`- 대상 URL: \`${baseUrl}\``)
    lines.push(`- 브라우저: chromium`)
    lines.push(`- HTML 리포트: \`playwright-report/index.html\``)
    lines.push(`- 생성: Playwright onEnd · **이 실행(${stamp})의 결과만** (이전 md·메타 재사용 없음)`)
    lines.push('')
    lines.push('| # | 시나리오 | 결과 |')
    lines.push('|---|---|---|')

    const IDS = sortScenarioIds(Object.keys(this.results))
    for (const id of IDS) {
      const rec = this.results[id] || {}
      const extra = meta.scenarios[id] || {}
      let status = rec.status || extra.status || 'skipped'
      if (extra.knownIssue && status === 'passed') status = 'known_issue'
      lines.push(`| ${id} | ${scenarioTitle(id, rec)} | ${statusLabel(status)} |`)
    }

    lines.push('')
    for (const id of IDS) {
      const rec = this.results[id] || {}
      const extra = meta.scenarios[id] || {}
      let status = rec.status || extra.status || 'skipped'
      if (extra.knownIssue && (status === 'passed' || !rec.status)) status = 'known_issue'
      lines.push(`## ${id}. ${scenarioTitle(id, rec)}`)
      lines.push('')
      lines.push(`- 결과: **${statusLabel(status)}**`)
      if (extra.site) lines.push(`- 사이트: \`${extra.site}\``)
      if (extra.db && Object.keys(extra.db).length) {
        lines.push('- 검증한 DB 값:')
        for (const [k, v] of Object.entries(extra.db)) {
          lines.push(`  - \`${k}\` = \`${typeof v === 'object' ? JSON.stringify(v) : v}\``)
        }
      }
      if (extra.knownIssue) {
        lines.push(`- 알려진 이슈: ${extra.knownIssue}`)
      }
      if (rec.error && status === 'failed') {
        lines.push(`- 에러: ${rec.error.split('\n')[0]}`)
      }
      const shots = extra.shots || []
      if (shots.length) {
        lines.push('')
        lines.push('### 캡처')
        lines.push('')
        const docAbs = resolve(docPath)
        for (const s of shots) {
          const relFromDoc = relative(dirname(docAbs), s.file).replace(/\\/g, '/')
          lines.push(`**${s.label}**`)
          lines.push('')
          lines.push(`![${s.label}](${relFromDoc})`)
          lines.push('')
        }
      }
      lines.push('')
    }

    mkdirSync(dirname(docPath), { recursive: true })
    writeFileSync(docPath, lines.join('\n'), 'utf8')
    console.log(`\n[e2e] 결과 문서: ${docPath}\n`)
  }
}

export default MdReporter
