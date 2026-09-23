'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { softDelete } from '@/lib/use-flag'
import { boardPath } from '@/lib/site-paths'
import { BOARD_TYPE_META, makeBoardKey } from '@/lib/user-board'

/**
 * 사장님 관리자 — 게시판 관리
 * 사장님은 **이름과 종류만** 고른다. 주소(board_key)는 자동 생성 (개발자 용어 비노출)
 */
export default function UserBoardsManager({ site, boards, posts, onReload }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('general')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [busy, setBusy] = useState(false)
  const [addError, setAddError] = useState('')
  const [msg, setMsg] = useState('')

  const countOf = (id) => posts.filter(p => p.user_board_id === id).length

  async function run(fn, okMsg, setError = setMsg) {
    setBusy(true); setMsg(''); setAddError('')
    try {
      await fn()
      await onReload()
      if (okMsg) setMsg(okMsg)
    } catch (e) {
      setError(String(e.message || e))
    }
    setBusy(false)
  }

  const addBoard = (e) => {
    e.preventDefault()
    run(async () => {
      if (!name.trim()) throw new Error('게시판 이름을 적어 주세요')
      const { error } = await supabase.from('user_boards').insert({
        site_id: site.site_id,
        name: name.trim(),
        board_key: makeBoardKey(type, boards),
        board_type: type,
        sort_order: Math.max(0, ...boards.map(b => b.sort_order || 0)) + 1,
      })
      if (error) throw error
      setName('')
      setType('general')
    }, `✅ 「${name.trim()}」 게시판을 만들었습니다`, setAddError)
  }

  const saveName = (b) => run(async () => {
    if (!editName.trim()) throw new Error('이름을 적어 주세요')
    const { error } = await supabase.from('user_boards')
      .update({ name: editName.trim(), updated_at: new Date().toISOString() })
      .eq('user_board_id', b.user_board_id)
    if (error) throw error
    setEditId(null)
  }, '이름을 바꿨습니다')

  const move = (idx, dir) => {
    const cur = boards[idx]
    const other = boards[idx + dir]
    if (!other) return
    run(async () => {
      const now = new Date().toISOString()
      const r1 = await supabase.from('user_boards').update({ sort_order: idx + dir + 1, updated_at: now }).eq('user_board_id', cur.user_board_id)
      const r2 = await supabase.from('user_boards').update({ sort_order: idx + 1, updated_at: now }).eq('user_board_id', other.user_board_id)
      if (r1.error || r2.error) throw (r1.error || r2.error)
    })
  }

  const remove = (b) => {
    const n = countOf(b.user_board_id)
    if (!window.confirm(`「${b.name}」 게시판을 삭제할까요?${n ? `\n글 ${n}개도 사이트에서 보이지 않게 됩니다.` : ''}`)) return
    run(() => softDelete(supabase, 'user_boards', 'user_board_id', b.user_board_id), '게시판을 삭제했습니다')
  }

  const card = { background: 'white', borderRadius: 14, border: '1px solid #e5e7eb' }
  const small = {
    background: 'white', border: '1px solid #e5e7eb', borderRadius: 7, padding: '6px 12px',
    fontSize: 12, cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap',
  }
  const arrow = (dis) => ({
    ...small, padding: '0 7px', lineHeight: '18px', opacity: dis ? 0.25 : 1,
    cursor: dis ? 'default' : 'pointer',
  })

  return (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#111827' }}>게시판</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>내 사이트 맨 위 메뉴에 이 순서로 보입니다.</p>

      {msg && <p style={{ fontSize: 13, color: msg.startsWith('✅') ? '#15803d' : '#ef4444', margin: '0 0 12px' }}>{msg}</p>}

      {/* 목록 */}
      <div style={{ ...card, overflow: 'hidden', marginBottom: 20 }}>
        {boards.length === 0 && (
          <p style={{ margin: 0, padding: 28, fontSize: 14, color: '#9ca3af', textAlign: 'center' }}>아직 게시판이 없습니다</p>
        )}
        {boards.map((b, i) => {
          const meta = BOARD_TYPE_META[b.board_type] || BOARD_TYPE_META.general
          const editing = editId === b.user_board_id
          return (
            <div key={b.user_board_id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', flexWrap: 'wrap',
              borderBottom: i < boards.length - 1 ? '1px solid #f3f4f6' : 'none',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <button type="button" title="위로" disabled={busy || i === 0} onClick={() => move(i, -1)} style={arrow(i === 0)}>▲</button>
                <button type="button" title="아래로" disabled={busy || i === boards.length - 1} onClick={() => move(i, 1)} style={arrow(i === boards.length - 1)}>▼</button>
              </div>

              <span style={{ fontSize: 22 }}>{meta.icon}</span>

              {editing ? (
                <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                  style={{ flex: 1, minWidth: 140, padding: '9px 12px', border: '1px solid #111827', borderRadius: 8, fontSize: 15, outline: 'none' }} />
              ) : (
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {meta.what} · 글 {countOf(b.user_board_id)}개
                  </div>
                </div>
              )}

              {editing ? (
                <>
                  <button type="button" disabled={busy} onClick={() => saveName(b)}
                    style={{ ...small, background: '#111827', color: 'white', border: 'none', fontWeight: 700 }}>저장</button>
                  <button type="button" onClick={() => setEditId(null)} style={small}>취소</button>
                </>
              ) : (
                <>
                  <a href={boardPath(site.subdomain, b.board_key)} target="_blank" rel="noreferrer"
                    style={{ ...small, textDecoration: 'none', color: '#6b7280' }}>사이트에서 보기 ↗</a>
                  <button type="button" onClick={() => { setEditId(b.user_board_id); setEditName(b.name) }} style={small}>이름 수정</button>
                  <button type="button" disabled={busy} onClick={() => remove(b)}
                    style={{ ...small, color: '#ef4444', borderColor: '#fecaca' }}>삭제</button>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* 추가 — 이름 + 종류만 */}
      <form onSubmit={addBoard} style={{ ...card, padding: 24 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#111827' }}>새 게시판 만들기</h3>

        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="이름 (예: 이용후기)"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '12px 14px', fontSize: 15,
            border: `1px solid ${addError ? '#ef4444' : '#e5e7eb'}`, borderRadius: 10, outline: 'none',
          }}
        />
        {addError && <p style={{ margin: '6px 2px 0', fontSize: 13, color: '#ef4444' }}>{addError}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ margin: '14px 0 18px' }}>
          {Object.entries(BOARD_TYPE_META).map(([key, meta]) => {
            const on = type === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setType(key)}
                style={{
                  textAlign: 'left', padding: '16px 16px 14px', borderRadius: 12, cursor: 'pointer',
                  border: on ? '2px solid #111827' : '1px solid #e5e7eb',
                  background: on ? '#111827' : 'white',
                  color: on ? 'white' : '#111827',
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 8 }}>{meta.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{meta.what}</div>
                <div style={{ fontSize: 12, color: on ? '#d1d5db' : '#9ca3af', lineHeight: 1.5 }}>{meta.detail}</div>
              </button>
            )
          })}
        </div>

        <button type="submit" disabled={busy} style={{
          padding: '12px 28px', background: '#111827', color: 'white', border: 'none',
          borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
        }}>
          만들기
        </button>
      </form>
    </div>
  )
}
