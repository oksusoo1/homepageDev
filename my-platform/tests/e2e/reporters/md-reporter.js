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
    const idMatch = title.match(/\b(S[1-7])\b/)
    const id = idMatch ? idMatch[1] : title
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

    for (const id of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7']) {
      const rec = this.results[id] || {}
      const extra = meta.scenarios[id] || {}
      let status = rec.status || extra.status || 'skipped'
      if (extra.knownIssue && status === 'passed') status = 'known_issue'
      lines.push(`| ${id} | ${TITLES[id]} | ${statusLabel(status)} |`)
    }

    lines.push('')
    for (const id of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7']) {
      const rec = this.results[id] || {}
      const extra = meta.scenarios[id] || {}
      let status = rec.status || extra.status || 'skipped'
      if (extra.knownIssue && (status === 'passed' || !rec.status)) status = 'known_issue'
      lines.push(`## ${id}. ${TITLES[id]}`)
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
