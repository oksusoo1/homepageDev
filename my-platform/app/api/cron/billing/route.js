import { NextResponse } from 'next/server'
import { runBillingBatch } from '@/lib/billing-batch'

/**
 * 구독 청구 배치 (목업) — 수동/추후 cron
 * POST /api/cron/billing
 * body: { asOf?: "YYYY-MM-DD" }
 * header: x-cron-secret (CRON_SECRET 설정 시 필수)
 *
 * ※ 매일 자동 실행은 아직 연결하지 않음
 */
export async function POST(request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const headerSecret = request.headers.get('x-cron-secret')
    if (cronSecret && headerSecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const asOf = body.asOf || body.asOfDate || undefined
    const result = await runBillingBatch({ asOfDate: asOf })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[billing-batch]', e)
    return NextResponse.json({ ok: false, error: e.message || String(e) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: 'POST { asOf?: "YYYY-MM-DD" } — 수동 배치. 자동 cron 미연결.',
  })
}
