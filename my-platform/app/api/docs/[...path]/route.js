import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { DOCS_DIR } from '../route'

export const dynamic = 'force-dynamic'

function resolveDocPath(segments) {
  const rel = Array.isArray(segments) ? segments.join('/') : String(segments || '')
  const normalized = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '')
  if (!normalized || normalized.startsWith('..')) return null

  const full = path.join(DOCS_DIR, normalized)
  if (!full.startsWith(DOCS_DIR)) return null
  if (!normalized.toLowerCase().endsWith('.html')) return null

  return { rel: normalized.replace(/\\/g, '/'), full }
}

export async function GET(req, { params }) {
  try {
    const { path: segments } = await params
    const resolved = resolveDocPath(segments)

    if (!resolved) {
      return NextResponse.json({ error: 'html 문서만 볼 수 있습니다.' }, { status: 400 })
    }

    try {
      const html = await fs.readFile(resolved.full, 'utf8')
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      })
    } catch {
      return NextResponse.json({ error: '없는 문서입니다.' }, { status: 404 })
    }
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
