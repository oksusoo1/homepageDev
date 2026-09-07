'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { onlyActive, USE_FLAG_OFF, USE_FLAG_ON } from '@/lib/use-flag'
import { clearCommonCodeCache, loadCommonCodes } from '@/lib/common-codes'

/**
 * AIFRONT식 공통코드 관리
 * - 코드(code) 불변
 * - 표시명/설명/순서/사용 편집
 * - 「코드 적용」= 클라이언트 캐시 갱신
 */
export default function PlatformCommonCodes() {
  const [groups, setGroups] = useState([])
  const [groupId, setGroupId] = useState('')
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState({})
  const [newCode, setNewCode] = useState({ code: '', label: '', description: '', sort_order: 99 })
  const [newGroup, setNewGroup] = useState({ group_code: '', name: '', description: '', ref_hint: '' })
  const [showAddGroup, setShowAddGroup] = useState(false)

  const group = groups.find(g => g.code_group_id === groupId) || null

  useEffect(() => { refreshGroups() }, [])

  useEffect(() => {
    if (groupId) refreshCodes(groupId)
  }, [groupId])

  async function refreshGroups() {
    setLoading(true)
    setMsg('')
    try {
      const { data, error } = await onlyActive(
        supabase.from('code_groups').select('*').order('group_code')
      )
      if (error) throw error
      setGroups(data || [])
      if (!groupId && data?.[0]) setGroupId(data[0].code_group_id)
      else if (groupId && data && !data.find(g => g.code_group_id === groupId) && data[0]) {
        setGroupId(data[0].code_group_id)
      }
    } catch (e) {
      setMsg('❌ ' + (e.message || String(e)))
    }
    setLoading(false)
  }

  async function refreshCodes(gid) {
    const { data, error } = await supabase
      .from('common_codes')
      .select('*')
      .eq('code_group_id', gid)
      .order('sort_order')
    if (error) {
      setMsg('❌ ' + error.message)
      return
    }
    setCodes(data || [])
    const d = {}
    for (const c of data || []) {
      d[c.common_code_id] = {
        label: c.label || '',
        description: c.description || '',
        sort_order: c.sort_order ?? 10,
        use_flag: c.use_flag ?? 1,
      }
    }
    setDrafts(d)
  }

  async function saveRow(id) {
    const d = drafts[id]
    if (!d) return
    setBusy(true)
    setMsg('')
    const { error } = await supabase.from('common_codes').update({
      label: d.label.trim(),
      description: d.description.trim() || null,
      sort_order: Number(d.sort_order) || 10,
      use_flag: d.use_flag ? USE_FLAG_ON : USE_FLAG_OFF,
      updated_at: new Date().toISOString(),
    }).eq('common_code_id', id)
    setBusy(false)
    if (error) setMsg('❌ ' + error.message)
    else {
      setMsg('✅ 저장됨 — 「코드 적용」을 누르면 화면 표시에 반영')
      await refreshCodes(groupId)
    }
  }

  async function softDeleteCode(id, code) {
    if (!window.confirm(`코드 "${code}" 를 사용안함(use_flag=0) 처리할까요?\n(코드값 자체는 삭제하지 않는 것을 권장)`)) return
    setBusy(true)
    const { error } = await supabase.from('common_codes').update({
      use_flag: USE_FLAG_OFF,
      updated_at: new Date().toISOString(),
    }).eq('common_code_id', id)
    setBusy(false)
    if (error) setMsg('❌ ' + error.message)
    else {
      setMsg('✅ 사용안함 처리')
      await refreshCodes(groupId)
    }
  }

  async function addCode() {
    if (!group) return
    const code = newCode.code.trim()
    const label = newCode.label.trim()
    if (!code || !label) {
      setMsg('❌ 코드·표시명 필수')
      return
    }
    setBusy(true)
    const { error } = await supabase.from('common_codes').insert({
      code_group_id: group.code_group_id,
      code,
      label,
      description: newCode.description.trim() || null,
      sort_order: Number(newCode.sort_order) || 99,
    })
    setBusy(false)
    if (error) setMsg('❌ ' + error.message)
    else {
      setNewCode({ code: '', label: '', description: '', sort_order: 99 })
      setMsg('✅ 코드 추가됨')
      await refreshCodes(groupId)
    }
  }

  async function addGroup() {
    const group_code = newGroup.group_code.trim().toUpperCase()
    const name = newGroup.name.trim()
    if (!group_code || !name) {
      setMsg('❌ 그룹코드·이름 필수')
      return
    }
    setBusy(true)
    const { data, error } = await supabase.from('code_groups').insert({
      group_code,
      name,
      description: newGroup.description.trim() || null,
      ref_hint: newGroup.ref_hint.trim() || null,
    }).select().single()
    setBusy(false)
    if (error) setMsg('❌ ' + error.message)
    else {
      setShowAddGroup(false)
      setNewGroup({ group_code: '', name: '', description: '', ref_hint: '' })
      await refreshGroups()
      if (data) setGroupId(data.code_group_id)
      setMsg('✅ 그룹 추가됨')
    }
  }

  async function applyCodes() {
    setBusy(true)
    try {
      clearCommonCodeCache()
      await loadCommonCodes({ force: true })
      setMsg('✅ 코드 적용됨 (캐시 갱신) — 목록 화면을 다시 열거나 새로고침하세요')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('common-codes-applied'))
      }
    } catch (e) {
      setMsg('❌ ' + (e.message || String(e)))
    }
    setBusy(false)
  }

  const input = {
    width: '100%', padding: '7px 10px', background: '#0f172a', color: '#e2e8f0',
    border: '1px solid #334155', borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
  }

  if (loading) {
    return <p style={{ color: '#64748b', fontSize: 13 }}>불러오는 중...</p>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: '0 0 6px', fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>공통코드</h3>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.6, maxWidth: 560 }}>
            DB에 저장되는 <strong style={{ color: '#94a3b8' }}>코드값</strong>은 바꾸지 마세요.
            표시명·설명·순서·사용여부만 수정한 뒤 <strong style={{ color: '#86efac' }}>코드 적용</strong>을 누르면 화면 라벨 캐시가 갱신됩니다.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={applyCodes}
          style={{
            padding: '10px 18px', background: '#16a34a', color: 'white', border: 'none',
            borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          코드 적용
        </button>
      </div>

      {msg && (
        <div style={{
          marginBottom: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: msg.startsWith('✅') ? '#052e16' : '#450a0a',
          color: msg.startsWith('✅') ? '#86efac' : '#fca5a5',
        }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={groupId}
          onChange={e => setGroupId(e.target.value)}
          style={{ ...input, width: 'auto', minWidth: 280, cursor: 'pointer' }}
        >
          {groups.map(g => (
            <option key={g.code_group_id} value={g.code_group_id}>
              {g.group_code} ({g.name})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowAddGroup(v => !v)}
          style={{
            padding: '8px 14px', background: 'transparent', color: '#94a3b8',
            border: '1px solid #334155', borderRadius: 7, cursor: 'pointer', fontSize: 12,
          }}
        >
          + 그룹 추가
        </button>
        {group?.ref_hint && (
          <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'ui-monospace, Consolas, monospace' }}>
            {group.ref_hint}
          </span>
        )}
      </div>

      {showAddGroup && (
        <div style={{
          background: '#111827', border: '1px solid #1e293b', borderRadius: 12,
          padding: 16, marginBottom: 16,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>그룹코드 *</div>
              <input value={newGroup.group_code} onChange={e => setNewGroup({ ...newGroup, group_code: e.target.value })}
                placeholder="BUILD_TYPE" style={input} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>이름 *</div>
              <input value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}
                placeholder="사이트 제작 유형" style={input} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>ref_hint</div>
              <input value={newGroup.ref_hint} onChange={e => setNewGroup({ ...newGroup, ref_hint: e.target.value })}
                placeholder="sites.build_type" style={input} />
            </div>
          </div>
          <button type="button" disabled={busy} onClick={addGroup}
            style={{ marginTop: 12, padding: '8px 16px', background: '#1e40af', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12 }}>
            그룹 저장
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: '#64748b', textAlign: 'left' }}>
              {['그룹', '코드', '표시명', '설명', '순서', '사용', ''].map(h => (
                <th key={h} style={{ padding: '8px 10px', borderBottom: '1px solid #1e293b', fontWeight: 600, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {codes.map(c => {
              const d = drafts[c.common_code_id] || {}
              return (
                <tr key={c.common_code_id} style={{ opacity: d.use_flag === 0 || d.use_flag === false ? 0.5 : 1 }}>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #1e293b', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {group?.group_code}
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #1e293b', fontFamily: 'ui-monospace, Consolas, monospace', color: '#e2e8f0' }}>
                    {c.code}
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #1e293b', minWidth: 120 }}>
                    <input
                      value={d.label ?? ''}
                      onChange={e => setDrafts(prev => ({ ...prev, [c.common_code_id]: { ...prev[c.common_code_id], label: e.target.value } }))}
                      style={input}
                    />
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #1e293b', minWidth: 160 }}>
                    <input
                      value={d.description ?? ''}
                      onChange={e => setDrafts(prev => ({ ...prev, [c.common_code_id]: { ...prev[c.common_code_id], description: e.target.value } }))}
                      style={input}
                    />
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #1e293b', width: 72 }}>
                    <input
                      type="number"
                      value={d.sort_order ?? 10}
                      onChange={e => setDrafts(prev => ({ ...prev, [c.common_code_id]: { ...prev[c.common_code_id], sort_order: e.target.value } }))}
                      style={input}
                    />
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #1e293b' }}>
                    <input
                      type="checkbox"
                      checked={d.use_flag === 1 || d.use_flag === true}
                      onChange={e => setDrafts(prev => ({
                        ...prev,
                        [c.common_code_id]: { ...prev[c.common_code_id], use_flag: e.target.checked ? 1 : 0 },
                      }))}
                    />
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap' }}>
                    <button type="button" disabled={busy} onClick={() => saveRow(c.common_code_id)}
                      style={{ marginRight: 6, padding: '5px 10px', background: '#1e40af', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                      저장
                    </button>
                    <button type="button" disabled={busy} onClick={() => softDeleteCode(c.common_code_id, c.code)}
                      style={{ padding: '5px 10px', background: 'transparent', color: '#fca5a5', border: '1px solid #7f1d1d', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                      사용안함
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p style={{ margin: '12px 0', fontSize: 11, color: '#64748b' }}>
        ※ 코드 컬럼은 과거 데이터와 연결되므로 변경하지 않습니다. 쓰지 않는 코드는 「사용안함」처리하세요.
      </p>

      <div style={{
        background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 16, marginTop: 8,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>+ 코드 추가</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>코드 *</div>
            <input value={newCode.code} onChange={e => setNewCode({ ...newCode, code: e.target.value })}
              placeholder="self" style={input} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>표시명 *</div>
            <input value={newCode.label} onChange={e => setNewCode({ ...newCode, label: e.target.value })}
              placeholder="직접" style={input} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>설명</div>
            <input value={newCode.description} onChange={e => setNewCode({ ...newCode, description: e.target.value })}
              style={input} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>순서</div>
            <input type="number" value={newCode.sort_order} onChange={e => setNewCode({ ...newCode, sort_order: e.target.value })}
              style={input} />
          </div>
        </div>
        <button type="button" disabled={busy} onClick={addCode}
          style={{ marginTop: 12, padding: '8px 16px', background: '#334155', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12 }}>
          코드 추가
        </button>
      </div>
    </div>
  )
}
