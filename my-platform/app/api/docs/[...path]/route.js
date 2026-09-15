import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { DOCS_DIR } from '../route'

export const dynamic = 'force-dynamic'

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function resolveDocPath(segments) {
  const rel = Array.isArray(segments) ? segments.join('/') : String(segments || '')
  const normalized = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '')
  if (!normalized || normalized.startsWith('..')) return null

  const full = path.join(DOCS_DIR, normalized)
  if (!full.startsWith(DOCS_DIR)) return null

  const lower = normalized.toLowerCase()
  if (!lower.endsWith('.html') && !lower.endsWith('.md')) return null

  return {
    rel: normalized.replace(/\\/g, '/'),
    full,
    kind: lower.endsWith('.md') ? 'md' : 'html',
  }
}

function pickTitleMd(md, fallback) {
  const m = md.match(/^#\s+(.+)$/m)
  return (m ? m[1].trim() : fallback)
}

/** Markdown → 미리보기용 HTML (Mermaid CDN 포함) */
function wrapMarkdownAsHtml(md, title) {
  const safeTitle = escapeHtml(title)
  const payload = JSON.stringify(md)
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <script src="https://cdn.jsdelivr.net/npm/marked@15.0.7/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11.6.0/dist/mermaid.min.js"></script>
  <style>
    :root { --bg:#f8f7f4; --ink:#1c1917; --dim:#78716c; --border:#e7e5e4; --code:#f5f5f4; --accent:#1e40af; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif; line-height:1.65; }
    .page { max-width:920px; margin:0 auto; padding:40px 24px 80px; }
    h1,h2,h3 { line-height:1.3; }
    h1 { font-size:28px; margin:0 0 12px; }
    h2 { font-size:18px; margin:32px 0 12px; border-bottom:1px solid var(--border); padding-bottom:6px; }
    h3 { font-size:16px; margin:24px 0 8px; }
    p,ul,ol,table { font-size:14px; }
    a { color:var(--accent); }
    code { background:var(--code); padding:2px 6px; border-radius:4px; font-size:.9em; }
    pre { background:#1c1917; color:#fafaf9; padding:14px 16px; border-radius:8px; overflow:auto; font-size:13px; }
    pre code { background:transparent; padding:0; color:inherit; }
    table { width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--border); border-radius:8px; overflow:hidden; }
    th,td { padding:8px 12px; border-bottom:1px solid var(--border); text-align:left; vertical-align:top; font-size:13px; }
    th { background:#f3f2ef; color:var(--dim); font-size:11px; }
    blockquote { margin:12px 0; padding:8px 14px; border-left:3px solid #a8a29e; color:var(--dim); background:#fff; }
    .mermaid { background:#fff; border:1px solid var(--border); border-radius:10px; padding:16px; margin:16px 0; overflow:auto; }
  </style>
</head>
<body>
  <div class="page" id="content">불러오는 중…</div>
  <script>
    const raw = ${payload};
    mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });

    function esc(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    marked.use({
      gfm: true,
      breaks: false,
      renderer: {
        code({ text, lang }) {
          if ((lang || '').trim() === 'mermaid') {
            return '<pre class="mermaid">' + esc(text) + '</pre>';
          }
          return false;
        }
      }
    });

    document.getElementById('content').innerHTML = marked.parse(raw);
    mermaid.run({ nodes: document.querySelectorAll('.mermaid') }).catch(function (e) {
      console.warn('mermaid', e);
    });
  </script>
</body>
</html>`
}

export async function GET(req, { params }) {
  try {
    const { path: segments } = await params
    const resolved = resolveDocPath(segments)

    if (!resolved) {
      return NextResponse.json({ error: 'html·md 문서만 볼 수 있습니다.' }, { status: 400 })
    }

    try {
      const body = await fs.readFile(resolved.full, 'utf8')

      if (resolved.kind === 'md') {
        const title = pickTitleMd(body, path.basename(resolved.rel, '.md'))
        const html = wrapMarkdownAsHtml(body, title)
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        })
      }

      return new Response(body, {
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
