'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { softDelete } from '@/lib/use-flag'
import { boardPath } from '@/lib/site-paths'
import { BOARD_TYPE_META, normalizeBoardKey } from '@/lib/user-board'

/**
 * 사장님 관리자 — 게시판 관리 (추가 · 이름 변경 · 순서 · 삭제)
 * 게시판 = 사이트 상단 메뉴에 순서대로 노출
 */
export default function UserBoardsManager({ site, boards, posts, onReload }) {
  const [form, setForm] = useState({ name: '', board_key: '', board_type: 'general' })
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const countOf = (id) => posts.filter(p => p.user_board_id === id).length

  async function run(fn, okMsg) {
    setBusy(true); setMsg('')
    try {
      await fn()
      await onReload()
      if (okMsg) setMsg(okMsg)
    } catch (e) {
      const text = String(e.message || e)
      setMsg('❌ ' + (text.includes('uq_user_boards_site_key') ? '이미 쓰고 있는 주소입니다' : text))
    }
    setBusy(false)
  }

  const addBoard = (e) => {
    e.preventDefault()
    run(async () => {
      const key = normalizeBoardKey(form.board_key)
      if (!form.name.trim()) throw new Error('게시판 이름을 입력해 주세요')
      if (!key) throw new Error('주소는 영문 소문자·숫자·- 로 입력해 주세요')
      const sort = Math.max(0, ...boards.map(b => b.sort_order || 0)) + 1
      const { error } = await supabase.from('user_boards').insert({
        site_id: site.site_id, name: form.name.trim(), board_key: key, board_type: form.board_type, sort_order: sort,
      })
      if (error) throw error
      setForm({ name: '', board_key: '', board_type: 'general' })
    }, '✅ 게시판을 추가했습니다')
  }

  const saveName = (b) => run(async () => {
    if (!editName.trim()) throw new Error('이름을 입력해 주세요')
    const { error } = await supabase.from('user_boards')
      .update({ name: editName.trim(), updated_at: new Date().toISOString() })
      .eq('user_board_id', b.user_board_id)
    if (error) throw error
    setEditId(null)
  }, '이름을 바꿨습니다')

  const move = (idx, dir) => {
    const other = boards[idx + dir]
    const cur = boards[idx]
    if (!other) return
    run(async () => {
      const now = new Date().toISOString()
      // 순서값이 같을 수 있어 인덱스 기준으로 재부여
      const a = idx + 1, b = idx + dir + 1
      const r1 = await supabase.from('user_boards').update({ sort_order: b, updated_at: now }).eq('user_board_id', cur.user_board_id)
      const r2 = await supabase.from('user_boards').update({ sort_order: a, updated_at: now }).eq('user_board_id', other.user_board_id)
      if (r1.error || r2.error) throw (r1.error || r2.error)
    })
  }

  const remove = (b) => {
    const n = countOf(b.user_board_id)
    if (!window.confirm(`「${b.name}」 게시판을 삭제할까요?${n ? `\n글 ${n}개도 사이트에서 보이지 않게 됩니다.` : ''}`)) return
    run(() => softDelete(supabase, 'user_boards', 'user_board_id', b.user_board_id), '게시판을 삭제했습니다')
  }

  const card = { background: 'white', borderRadius: 14, border: '1px solid #e5e7eb' }
  const input = { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white' }
  const small = { background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer', color: '#374151' }

  return (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#111827' }}>게시판 관리</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>게시판은 사이트 상단 메뉴에 이 순서대로 보입니다.</p>

      {msg && <p style={{ fontSize: 13, color: msg.startsWith('❌') ? '#ef4444' : '#15803d', margin: '0 0 12px' }}>{msg}</p>}

      <div style={{ ...card, overflow: 'hidden', marginBottom: 16 }}>
        {boards.length === 0 && <p style={{ margin: 0, padding: 24, fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>게시판이 없습니다</p>}
        {boards.map((b, i) => (
          <div key={b.user_board_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: i < boards.length - 1 ? '1px solid #f3f4f6' : 'none', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} style={{ ...small, padding: '0 6px', opacity: i === 0 ? 0.3 : 1 }}>▲</button>
              <button type="button" disabled={busy || i === boards.length - 1} onClick={() => move(i, 1)} style={{ ...small, padding: '0 6px', opacity: i === boards.length - 1 ? 0.3 : 1 }}>▼</button>
            </div>
            {editId === b.user_board_id ? (
              <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus style={{ ...input, flex: 1, minWidth: 120 }} />
            ) : (
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{b.name}</div>
                <a href={boardPath(site.subdomain, b.board_key)} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#9ca3af', textDecoration: 'none' }}>
                  /board/{b.board_key} ↗
                </a>
              </div>
            )}
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6 }}>
              {BOARD_TYPE_META[b.board_type]?.label || b.board_type}
            </span>
            <span style={{ fontSize: 12, color: '#6b7280', width: 44, textAlign: 'right' }}>글 {countOf(b.user_board_id)}</span>
            {editId === b.user_board_id ? (
              <>
                <button type="button" disabled={busy} onClick={() => saveName(b)} style={small}>저장</button>
                <button type="button" onClick={() => setEditId(null)} style={small}>취소</button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => { setEditId(b.user_board_id); setEditName(b.name) }} style={small}>이름 변경</button>
                <button type="button" disabled={busy} onClick={() => remove(b)} style={{ ...small, color: '#ef4444', borderColor: '#fecaca' }}>삭제</button>
              </>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={addBoard} style={{ ...card, padding: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#111827' }}>게시판 추가</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="이름 (예: 이용후기)" style={{ ...input, flex: 1, minWidth: 140 }} />
          <input value={form.board_key} onChange={e => setForm({ ...form, board_key: normalizeBoardKey(e.target.value) })} placeholder="주소 (예: review)" style={{ ...input, width: 150 }} />
          <select value={form.board_type} onChange={e => setForm({ ...form, board_type: e.target.value })} style={input}>
            {Object.entries(BOARD_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button type="submit" disabled={busy} style={{ padding: '9px 18px', background: '#111827', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>추가</button>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>
          공지 = 사장님만 작성 · 문의 = 고객 작성, 비밀글, 답변 필요 · 일반 = 고객 작성
        </p>
      </form>
    </div>
  )
}
