'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

function fmtSize(n) {
  return n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + 'MB' : Math.round(n / 1024) + 'KB'
}

function docUrl(relPath) {
  return '/api/docs/' + relPath.split('/').map(encodeURIComponent).join('/')
}

const CATEGORY_STYLE = {
  ERD: { background: '#422006', color: '#fcd34d' },
  DB: { background: '#1e3a5f', color: '#93c5fd' },
  플로우: { background: '#3b2f4a', color: '#d8b4fe' },
  기타: { background: '#334155', color: '#94a3b8' },
}

export default function DocsBrowser() {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const timer = useRef(null)

  const load = useCallback(async (query) => {
    setLoading(true)
    try {
      const url = '/api/docs' + (query ? '?q=' + encodeURIComponent(query) : '')
      const d = await fetch(url, { cache: 'no-store' }).then((r) => r.json())
      if (d.error && !d.rows) throw new Error(d.error)
      setRows(d.rows || [])
      setError(d.error || null)
    } catch (e) {
      setError(e.message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load('') }, [load])

  function onQuery(v) {
    setQ(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => load(v.trim()), 250)
  }

  if (open) {
    const doc = rows.find((r) => r.name === open)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => setOpen(null)} style={btnSecondary}>← 목록</button>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{doc?.title || open}</h2>
          <a href={docUrl(open)} target="_blank" rel="noreferrer"
            style={{ fontSize: 13, color: '#60a5fa', textDecoration: 'none' }}>새 탭에서 열기 ↗</a>
          <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginLeft: 'auto' }}>docs/{open}</span>
        </div>
        <iframe
          src={docUrl(open)}
          title={doc?.title || open}
          style={{ width: '100%', border: '1px solid #1e293b', borderRadius: 8, background: '#fff', height: 'calc(100vh - 220px)' }}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input
          value={q}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="제목·본문 검색 (예: 플로우, staff, DB, trial)"
          style={inputStyle}
        />
        <span style={{ fontSize: 13, color: '#64748b' }}>{loading ? '읽는 중…' : `${rows.length}건`}</span>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#450a0a', color: '#fca5a5', fontSize: 13 }}>{error}</div>
      )}

      {!loading && !rows.length && (
        <div style={{ padding: '48px 0', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
          {q ? `'${q}' 에 걸리는 문서가 없습니다.` : 'docs/ 폴더에 HTML 문서가 없습니다.'}
        </div>
      )}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {rows.map((r) => {
          const catStyle = CATEGORY_STYLE[r.category] || CATEGORY_STYLE.기타
          return (
          <button key={r.name} onClick={() => setOpen(r.name)} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748b', marginBottom: 8 }}>
              <span style={{ fontFamily: 'monospace' }}>{r.date}</span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ ...catStyle, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>{r.category}</span>
                <span>{fmtSize(r.size)}</span>
              </span>
            </div>
            <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 4, lineHeight: 1.4 }}>{r.title}</div>
            <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginBottom: 8 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{r.excerpt}</div>
          </button>
        )})}
      </div>
    </div>
  )
}

const inputStyle = {
  border: '1px solid #1e293b', borderRadius: 8, padding: '9px 14px', fontSize: 14,
  width: '100%', maxWidth: 400, background: '#0f172a', color: '#f1f5f9', outline: 'none',
}
const btnSecondary = {
  padding: '6px 14px', borderRadius: 6, border: '1px solid #334155',
  background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: 'pointer',
}
const cardStyle = {
  textAlign: 'left', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10,
  padding: 16, cursor: 'pointer', transition: 'border-color 0.15s',
}
