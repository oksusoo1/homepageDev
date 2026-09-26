import { NextResponse } from 'next/server'
import { runBillingBatch } from '@/lib/billing-batch'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 구독 청구 배치 (목업) — 수동/추후 cron
 * POST /api/cron/billing
 * body: { asOf?: "YYYY-MM-DD", siteIds?: string[] }
 * header: x-cron-secret = CRON_SECRET (미설정·불일치 → 401)
 */
export async function POST(request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const headerSecret = request.headers.get('x-cron-secret')
    if (!cronSecret || headerSecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const asOf = body.asOf || body.asOfDate || undefined
    const siteIds = Array.isArray(body.siteIds) ? body.siteIds : undefined
    const result = await runBillingBatch({ asOfDate: asOf, siteIds, client: createAdminClient() })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[billing-batch]', e)
    return NextResponse.json({ ok: false, error: e.message || String(e) }, { status: 500 })
  }
}
