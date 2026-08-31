import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'

export const dynamic = 'force-dynamic'

/** my-platform/docs — HTML 파일 (하위 폴더 포함) */
export const DOCS_DIR = path.join(process.cwd(), 'docs')

function pickTitle(html, fallback) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i)
  return (m ? m[1] : fallback).trim()
}

export function plainText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pickDate(name, mtime) {
  const m = name.match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : mtime.toISOString().slice(0, 10)
}

function pickCategory(relPath) {
  if (relPath.startsWith('db/') && /ERD/i.test(relPath)) return 'ERD'
  if (relPath.startsWith('db/')) return 'DB'
  if (relPath.includes('플로우')) return '플로우'
  return '기타'
}

async function collectHtmlFiles(dir, prefix = '') {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const rows = []

  for (const ent of entries) {
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name
    const full = path.join(dir, ent.name)

    if (ent.isDirectory()) {
      rows.push(...await collectHtmlFiles(full, rel))
      continue
    }
    if (!ent.name.toLowerCase().endsWith('.html')) continue

    const [st, html] = await Promise.all([fs.stat(full), fs.readFile(full, 'utf8')])
    rows.push({ rel, full, st, html })
  }

  return rows
}

export async function GET(req) {
  try {
    const q = (req.nextUrl.searchParams.get('q') || '').trim().toLowerCase()

    let files
    try {
      files = await collectHtmlFiles(DOCS_DIR)
    } catch {
      return NextResponse.json({ rows: [], error: 'docs 폴더를 찾을 수 없습니다.' })
    }

    const rows = []
    for (const { rel, st, html } of files) {
      const text = plainText(html)
      const title = pickTitle(html, rel.replace(/\.html$/i, ''))
      const category = pickCategory(rel)

      if (q) {
        const hay = (title + ' ' + rel + ' ' + category + ' ' + text).toLowerCase()
        if (!hay.includes(q)) continue
      }

      let excerpt = text.slice(0, 160)
      if (q) {
        const i = text.toLowerCase().indexOf(q)
        if (i >= 0) excerpt = (i > 40 ? '… ' : '') + text.slice(Math.max(0, i - 40), i + 130)
      }

      rows.push({
        name: rel,
        title,
        category,
        date: pickDate(rel, st.mtime),
        size: st.size,
        excerpt,
      })
    }

    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)))
    return NextResponse.json({ rows, count: rows.length, query: q })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
