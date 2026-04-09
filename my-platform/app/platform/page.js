'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/auth'

const TABS = ['사이트 관리', '구독 현황', '수정 요청', '1회성 결제']

export default function AdminConsole() {
  const router = useRouter()
  const [tab, setTab] = useState(0)
  const [sites, setSites] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [tickets, setTickets] = useState([])
  const [oneTimePays, setOneTimePays] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    customer_name: '', customer_email: '', customer_phone: '',
    site_name: '', subdomain: '', description: '',
    address: '', phone: '', email: '',
    template_id: '', build_type: 'self'
  })

  useEffect(() => { checkAdminAuth() }, [])

  async function checkAdminAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !isAdminEmail(user.email)) {
      router.push('/login')
      return
    }
    setAuthChecked(true)
    fetchAll()
  }

  async function fetchAll() {
    const [s, sub, t, otp, tmpl] = await Promise.all([
      supabase.from('sites')
        .select('*, customers(name, email, phone)')
        .order('created_at', { ascending: false }),
      supabase.from('subscriptions')
        .select('*, sites(site_name:name, subdomain), customers(name)')
        .order('created_at', { ascending: false }),
      supabase.from('support_tickets')
        .select('*, sites(name), customers(name)')
        .order('created_at', { ascending: false }),
      supabase.from('one_time_payments')
        .select('*, customers(name), sites(name)')
        .order('created_at', { ascending: false }),
      supabase.from('templates')
        .select('*').eq('is_active', true).order('sort_order'),
    ])
    setSites(s.data || [])
    setSubscriptions(sub.data || [])
    setTickets(t.data || [])
    setOneTimePays(otp.data || [])
    setTemplates(tmpl.data || [])
  }

  async function createSite(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      // 1. 고객 생성
      const { data: customer, error: cErr } = await supabase
        .from('customers')
        .insert([{
          email: form.customer_email,
          name: form.customer_name,
          phone: form.customer_phone,
        }])
        .select()
        .single()
      if (cErr) throw new Error('고객 생성 오류: ' + cErr.message)

      // 2. 사이트 생성
      const site_code = form.subdomain + '_' + Date.now()
      const { data: site, error: sErr } = await supabase
        .from('sites')
        .insert([{
          site_code,
          customer_id: customer.customer_id,
          template_id: form.template_id || null,
          name: form.site_name,
          subdomain: form.subdomain,
          description: form.description,
          address: form.address,
          phone: form.phone,
          email: form.email,
          build_type: form.build_type,
          status: 'draft',
          deploy_status: 'pending',
        }])
        .select()
        .single()
      if (sErr) throw new Error('사이트 생성 오류: ' + sErr.message)

      // 3. 구독 생성
      const nextMonth = new Date()
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      const { error: subErr } = await supabase
        .from('subscriptions')
        .insert([{
          customer_id: customer.customer_id,
          site_id: site.site_id,
          amount: 30000,
          billing_day: 1,
          payment_method: 'manual',
          status: 'active',
          next_billing_date: nextMonth.toISOString().split('T')[0],
        }])
      if (subErr) throw new Error('구독 생성 오류: ' + subErr.message)

      setMessage('✅ 사이트가 생성되었습니다!')
      setForm({
        customer_name: '', customer_email: '', customer_phone: '',
        site_name: '', subdomain: '', description: '',
        address: '', phone: '', email: '', template_id: '', build_type: 'self'
      })
      fetchAll()
    } catch (err) {
      setMessage('❌ ' + err.message)
    }
    setLoading(false)
  }

  async function updateSiteStatus(siteId, status) {
    await supabase.from('sites').update({ status }).eq('site_id', siteId)
    fetchAll()
  }

  async function updateTicketStatus(ticketId, status) {
    const update = { status }
    if (status === 'resolved') update.resolved_at = new Date().toISOString()
    await supabase.from('support_tickets').update(update).eq('ticket_id', ticketId)
    fetchAll()
  }

  async function markBillingPaid(subId, amount, period) {
    const { data: existing } = await supabase
      .from('billing_history')
      .select('billing_id')
      .eq('subscription_id', subId)
      .eq('period', period)
      .single()

    if (existing) {
      await supabase.from('billing_history')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('billing_id', existing.billing_id)
    } else {
      await supabase.from('billing_history').insert([{
        subscription_id: subId,
        period,
        amount,
        status: 'paid',
        payment_method: 'manual',
        paid_at: new Date().toISOString(),
      }])
    }
    fetchAll()
  }

  async function markOneTimePaid(paymentId) {
    await supabase.from('one_time_payments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('payment_id', paymentId)
    fetchAll()
  }

  const currentPeriod = new Date().toISOString().slice(0, 7)
  const activeSubCount = subscriptions.filter(s => s.status === 'active').length
  const pendingTickets = tickets.filter(t => t.status !== 'resolved').length
  const unpaidOtp = oneTimePays.filter(p => p.status === 'unpaid').length

  // 스타일
  const css = {
    page: {
      minHeight: '100vh',
      background: '#0a0a0f',
      color: '#e2e8f0',
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    },
    header: {
      background: '#0d0d14',
      borderBottom: '1px solid #1e293b',
      padding: '0 16px',
      minHeight: 56,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    },
    content: { maxWidth: 1200, margin: '0 auto', padding: '20px 12px' },
    stats: {
      display: 'grid',
      gap: 16,
      marginBottom: 28,
    },
    statCard: {
      background: '#111827',
      border: '1px solid #1e293b',
      borderRadius: 10,
      padding: '18px 20px',
    },
    tabs: {
      display: 'flex',
      borderBottom: '1px solid #1e293b',
      marginBottom: 24,
    },
    card: {
      background: '#111827',
      border: '1px solid #1e293b',
      borderRadius: 12,
      padding: 24,
      marginBottom: 20,
    },
    input: {
      width: '100%',
      padding: '9px 13px',
      background: '#0f172a',
      border: '1px solid #334155',
      borderRadius: 7,
      color: '#e2e8f0',
      fontSize: 13,
      outline: 'none',
      boxSizing: 'border-box',
    },
    label: {
      display: 'block',
      fontSize: 11,
      color: '#64748b',
      marginBottom: 5,
      fontWeight: 600,
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
    },
    grid2: { display: 'grid', gap: 14 },
    grid3: { display: 'grid', gap: 14 },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: {
      padding: '9px 14px',
      textAlign: 'left',
      fontSize: 11,
      color: '#475569',
      fontWeight: 600,
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      borderBottom: '1px solid #1e293b',
    },
    td: {
      padding: '13px 14px',
      fontSize: 13,
      borderBottom: '1px solid #0f172a',
      verticalAlign: 'middle',
    },
  }

  const badge = (color, text) => (
    <span style={{
      padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: color + '22', color, display: 'inline-block'
    }}>{text}</span>
  )

  const btn = (color, text, onClick) => (
    <button onClick={onClick} style={{
      padding: '6px 13px', background: color, color: 'white',
      border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600
    }}>{text}</button>
  )

  const STATUS_COLOR = { draft: '#f59e0b', published: '#22c55e', suspended: '#ef4444', cancelled: '#6b7280' }
  const TICKET_COLOR = { open: '#f59e0b', in_progress: '#60a5fa', resolved: '#22c55e' }
  const TYPE_LABEL = { domain_setup: '도메인 대행', dev_fee: '개발비', extra: '기타' }
  const TYPE_COLOR = { domain_setup: '#8b5cf6', dev_fee: '#f59e0b', extra: '#6b7280' }

  if (!authChecked) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', color: '#9ca3af', fontSize: 14 }}>
      인증 확인 중...
    </div>
  )

  return (
    <div style={css.page}>

      {/* 헤더 */}
      <div style={css.header}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', letterSpacing: 2 }}>MY PLATFORM</span>
        <span style={{ fontSize: 11, background: '#1e40af22', color: '#60a5fa', padding: '2px 9px', borderRadius: 4 }}>
          관리자 콘솔
        </span>
        <div className="ml-auto hidden sm:flex gap-5 text-xs text-gray-500">
          <span>사이트 {sites.length}개</span>
          <span>구독 {activeSubCount}개</span>
          <span style={{ color: pendingTickets > 0 ? '#f59e0b' : '#475569' }}>
            미처리 티켓 {pendingTickets}건
          </span>
        </div>
      </div>

      <div style={css.content}>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
          {[
            { label: '전체 사이트', value: sites.length, color: '#60a5fa' },
            { label: '활성 구독', value: activeSubCount, color: '#22c55e' },
            { label: '이번달 예상 수익', value: `₩${(activeSubCount * 30000).toLocaleString()}`, color: '#a78bfa' },
            { label: '미처리 티켓', value: pendingTickets, color: pendingTickets > 0 ? '#f59e0b' : '#22c55e' },
          ].map(({ label, value, color }) => (
            <div key={label} style={css.statCard}>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 8, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* 탭 */}
        <div className="flex border-b border-[#1e293b] mb-6 overflow-x-auto">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{
              padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              color: tab === i ? '#60a5fa' : '#475569',
              background: 'none', border: 'none', whiteSpace: 'nowrap',
              borderBottom: tab === i ? '2px solid #60a5fa' : '2px solid transparent',
            }}>{t}</button>
          ))}
        </div>

        {/* ── 탭 0: 사이트 관리 ── */}
        {tab === 0 && (
          <>
            <div style={css.card}>
              <h3 style={{ margin: '0 0 20px', fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>+ 새 사이트 개설</h3>
              <form onSubmit={createSite}>

                {/* 고객 정보 */}
                <p style={{ ...css.label, marginBottom: 10 }}>고객 정보</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {[
                    { key: 'customer_name',  label: '이름 *',  ph: '홍길동' },
                    { key: 'customer_email', label: '이메일 *', ph: 'hong@email.com' },
                    { key: 'customer_phone', label: '연락처',   ph: '010-0000-0000' },
                  ].map(({ key, label, ph }) => (
                    <div key={key}>
                      <label style={css.label}>{label}</label>
                      <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                        placeholder={ph} required={label.includes('*')} style={css.input} />
                    </div>
                  ))}
                </div>

                {/* 사이트 정보 */}
                <p style={{ ...css.label, margin: '18px 0 10px' }}>사이트 정보</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {[
                    { key: 'site_name',  label: '사이트명 *', ph: '홍길동 카페' },
                    { key: 'subdomain',  label: '서브도메인 *', ph: 'hong' },
                    { key: 'phone',      label: '전화번호', ph: '02-0000-0000' },
                    { key: 'email',      label: '사이트 이메일', ph: 'info@site.com' },
                    { key: 'address',    label: '주소', ph: '서울시 강남구...' },
                  ].map(({ key, label, ph }) => (
                    <div key={key}>
                      <label style={css.label}>{label}</label>
                      <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                        placeholder={ph} required={label.includes('*')} style={css.input} />
                    </div>
                  ))}
                  <div>
                    <label style={css.label}>개발 유형 *</label>
                    <select value={form.build_type} onChange={e => setForm({ ...form, build_type: e.target.value })}
                      style={{ ...css.input, cursor: 'pointer' }}>
                      <option value="self">고객 직접 (루트 A)</option>
                      <option value="managed">본사 대리 (루트 B)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3.5">
                  <div>
                    <label style={css.label}>소개글</label>
                    <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                      placeholder="업체 소개를 입력하세요..." rows={2}
                      style={{ ...css.input, resize: 'vertical' }} />
                  </div>
                  <div>
                    <label style={css.label}>템플릿</label>
                    <select value={form.template_id} onChange={e => setForm({ ...form, template_id: e.target.value })}
                      style={{ ...css.input, cursor: 'pointer', height: 72 }}>
                      <option value="">선택 안 함</option>
                      {templates.map(t => (
                        <option key={t.template_id} value={t.template_id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <button type="submit" disabled={loading} style={{
                    padding: '9px 22px', background: '#2563eb', color: 'white',
                    border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13,
                    fontWeight: 700, opacity: loading ? 0.6 : 1
                  }}>
                    {loading ? '생성 중...' : '사이트 + 구독 생성'}
                  </button>
                  {message && (
                    <span style={{ fontSize: 13, color: message.startsWith('✅') ? '#22c55e' : '#ef4444' }}>
                      {message}
                    </span>
                  )}
                </div>
              </form>
            </div>

            {/* 사이트 목록 */}
            <div style={css.card}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>
                사이트 목록 ({sites.length}개)
              </h3>
              <div className="overflow-x-auto -mx-6 px-6">
              <table style={css.table}>
                <thead>
                  <tr>{['사이트명', '고객', '서브도메인', '유형', '체험현황', '상태', '액션'].map(h =>
                    <th key={h} style={{ ...css.th, whiteSpace: 'nowrap' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sites.map(site => {
                    const now = new Date()
                    const trialEnds = site.trial_ends_at ? new Date(site.trial_ends_at) : null
                    const daysLeft = trialEnds ? Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24)) : null
                    const trialBadge = !trialEnds ? badge('#475569', '체험 없음')
                      : daysLeft > 0  ? badge('#f59e0b', `체험중 D-${daysLeft}`)
                      : site.status === 'suspended' ? badge('#ef4444', '만료·정지')
                      : badge('#ef4444', `만료 ${Math.abs(daysLeft)}일 초과`)
                    return (
                      <tr key={site.site_id}>
                        <td style={css.td}><strong>{site.name}</strong><br />
                          <span style={{ fontSize: 11, color: '#64748b' }}>{site.site_code}</span>
                        </td>
                        <td style={css.td}>
                          {site.customers?.name}<br />
                          <span style={{ fontSize: 11, color: '#64748b' }}>{site.customers?.email}</span>
                        </td>
                        <td style={css.td}>
                          <a href={`/preview/${site.subdomain}`} target="_blank"
                            style={{ color: '#60a5fa', textDecoration: 'none', fontSize: 12 }}>
                            {site.subdomain} →
                          </a>
                          {site.domain && <div style={{ fontSize: 11, color: '#64748b' }}>{site.domain}</div>}
                        </td>
                        <td style={css.td}>
                          {badge(site.build_type === 'self' ? '#60a5fa' : '#f59e0b',
                            site.build_type === 'self' ? '직접' : '대리')}
                        </td>
                        <td style={css.td}>{trialBadge}</td>
                        <td style={css.td}>{badge(STATUS_COLOR[site.status] || '#6b7280', site.status)}</td>
                        <td style={css.td}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {site.status === 'draft' && btn('#16a34a', '배포', () => updateSiteStatus(site.site_id, 'published'))}
                            {site.status === 'published' && btn('#dc2626', '정지', () => updateSiteStatus(site.site_id, 'suspended'))}
                            {site.status === 'suspended' && btn('#2563eb', '복구', () => updateSiteStatus(site.site_id, 'published'))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </>
        )}

        {/* ── 탭 1: 구독 현황 ── */}
        {tab === 1 && (
          <div style={css.card}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>
              구독 현황 — 이번달 예상 ₩{(activeSubCount * 30000).toLocaleString()}
            </h3>
            <div className="overflow-x-auto -mx-6 px-6">
            <table style={css.table}>
              <thead>
                <tr>{['고객', '사이트', '월 구독료', '결제방식', '다음 청구일', '상태', '이번달 납부'].map(h =>
                  <th key={h} style={{ ...css.th, whiteSpace: 'nowrap' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {subscriptions.map(sub => (
                  <tr key={sub.subscription_id}>
                    <td style={css.td}>{sub.customers?.name}</td>
                    <td style={css.td}>{sub.sites?.site_name}</td>
                    <td style={css.td}>₩{sub.amount?.toLocaleString()}</td>
                    <td style={css.td}>
                      {badge(sub.payment_method === 'card' ? '#22c55e' : '#f59e0b',
                        sub.payment_method === 'card' ? '카드' : '수동')}
                    </td>
                    <td style={css.td}>{sub.next_billing_date}</td>
                    <td style={css.td}>
                      {badge(sub.status === 'active' ? '#22c55e' : '#ef4444', sub.status)}
                    </td>
                    <td style={css.td}>
                      {btn('#16a34a', '납부 확인', () => markBillingPaid(sub.subscription_id, sub.amount, currentPeriod))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* ── 탭 2: 수정 요청 ── */}
        {tab === 2 && (
          <div style={css.card}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>
              수정 요청 — {pendingTickets}건 미처리
            </h3>
            <div className="overflow-x-auto -mx-6 px-6">
            <table style={css.table}>
              <thead>
                <tr>{['사이트', '고객', '제목', '유형', '우선순위', '상태', '기한', '처리'].map(h =>
                  <th key={h} style={{ ...css.th, whiteSpace: 'nowrap' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => {
                  const overdue = new Date(t.deadline_at) < new Date() && t.status !== 'resolved'
                  return (
                    <tr key={t.ticket_id}>
                      <td style={css.td}>{t.sites?.name}</td>
                      <td style={css.td}>{t.customers?.name}</td>
                      <td style={css.td}>{t.title}</td>
                      <td style={css.td}>{t.category || '-'}</td>
                      <td style={css.td}>
                        {badge(
                          t.priority === 'urgent' ? '#ef4444' : t.priority === 'high' ? '#f59e0b' : '#60a5fa',
                          t.priority
                        )}
                      </td>
                      <td style={css.td}>{badge(TICKET_COLOR[t.status] || '#6b7280', t.status)}</td>
                      <td style={{ ...css.td, color: overdue ? '#ef4444' : '#94a3b8', fontSize: 12 }}>
                        {overdue ? '⚠️ ' : ''}{new Date(t.deadline_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td style={css.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {t.status === 'open' && btn('#2563eb', '처리시작', () => updateTicketStatus(t.ticket_id, 'in_progress'))}
                          {t.status !== 'resolved' && btn('#16a34a', '완료', () => updateTicketStatus(t.ticket_id, 'resolved'))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {tickets.length === 0 && (
                  <tr><td colSpan={8} style={{ ...css.td, textAlign: 'center', color: '#475569' }}>티켓이 없습니다</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* ── 탭 3: 1회성 결제 ── */}
        {tab === 3 && (
          <div style={css.card}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>
              1회성 결제 — 미납 {unpaidOtp}건
            </h3>
            <div className="overflow-x-auto -mx-6 px-6">
            <table style={css.table}>
              <thead>
                <tr>{['고객', '사이트', '유형', '금액', '상태', '메모', '처리'].map(h =>
                  <th key={h} style={{ ...css.th, whiteSpace: 'nowrap' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {oneTimePays.map(pay => (
                  <tr key={pay.payment_id}>
                    <td style={css.td}>{pay.customers?.name}</td>
                    <td style={css.td}>{pay.sites?.name || '-'}</td>
                    <td style={css.td}>{badge(TYPE_COLOR[pay.type], TYPE_LABEL[pay.type])}</td>
                    <td style={css.td}>₩{pay.amount?.toLocaleString()}</td>
                    <td style={css.td}>
                      {badge(pay.status === 'paid' ? '#22c55e' : '#f59e0b',
                        pay.status === 'paid' ? '납부완료' : '미납')}
                    </td>
                    <td style={{ ...css.td, fontSize: 12, color: '#64748b' }}>{pay.note || '-'}</td>
                    <td style={css.td}>
                      {pay.status === 'unpaid' && btn('#16a34a', '납부확인', () => markOneTimePaid(pay.payment_id))}
                    </td>
                  </tr>
                ))}
                {oneTimePays.length === 0 && (
                  <tr><td colSpan={7} style={{ ...css.td, textAlign: 'center', color: '#475569' }}>내역이 없습니다</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
