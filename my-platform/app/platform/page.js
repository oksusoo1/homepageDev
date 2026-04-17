'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/auth'

const TABS = ['사이트 관리', '구독 현황', '수정 요청', '1회성 결제', '제작 문의']

export default function AdminConsole() {
  const router = useRouter()
  const [tab, setTab] = useState(0)
  const [sites, setSites] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [tickets, setTickets] = useState([])
  const [oneTimePays, setOneTimePays] = useState([])
  const [inquiries, setInquiries] = useState([])
  const [templates, setTemplates] = useState([])
  const [expandedSubId, setExpandedSubId] = useState(null)     // 펼쳐진 구독 행
  const [billingHistory, setBillingHistory] = useState({})      // { sub_id: [...records] }
  const [inquiryDevFee, setInquiryDevFee] = useState({})        // { inquiry_id: 금액 } — 견적 편집용
  const [loading, setLoading] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    customer_name: '', customer_email: '', customer_phone: '',
    site_name: '', subdomain: '', description: '',
    address: '', phone: '', email: '',
    template_id: '', build_type: 'self', inquiry_id: '',
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
    const [s, sub, t, otp, tmpl, inq] = await Promise.all([
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
      supabase.from('inquiries')
        .select('*, customers(name, email, phone)')
        .order('created_at', { ascending: false }),
    ])
    setSites(s.data || [])
    setSubscriptions(sub.data || [])
    setTickets(t.data || [])
    setOneTimePays(otp.data || [])
    setTemplates(tmpl.data || [])
    setInquiries(inq.data || [])
  }

  async function createSite(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      // 1. 기존 고객 조회 → 없으면 신규 생성
      let customer
      const { data: existing } = await supabase
        .from('customers')
        .select('*')
        .eq('email', form.customer_email)
        .maybeSingle()

      if (existing) {
        customer = existing
      } else {
        const { data: newCust, error: cErr } = await supabase
          .from('customers')
          .insert([{
            email: form.customer_email,
            name: form.customer_name,
            phone: form.customer_phone,
          }])
          .select()
          .single()
        if (cErr) throw new Error('고객 생성 오류: ' + cErr.message)
        customer = newCust
      }

      // 2. 사이트 생성
      const site_code = form.subdomain + '_' + Date.now()
      const { error: sErr } = await supabase
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
          inquiry_id: form.inquiry_id || null,
          status: 'draft',
          deploy_status: 'pending',
        }])
        .select()
        .single()
      if (sErr) throw new Error('사이트 생성 오류: ' + sErr.message)

      // 구독은 고객이 카드 등록 + 배포 시점에 생성 (deploy.js에서 처리)
      setMessage('✅ 사이트가 생성되었습니다!')
      setForm({
        customer_name: '', customer_email: '', customer_phone: '',
        site_name: '', subdomain: '', description: '',
        address: '', phone: '', email: '', template_id: '', build_type: 'self', inquiry_id: '',
      })
      fetchAll()
    } catch (err) {
      setMessage('❌ ' + err.message)
    }
    setLoading(false)
  }

  async function updateSiteStatus(siteId, status) {
    const now = new Date()

    if (status === 'published') {
      // build_type 먼저 조회 (managed vs self 분기)
      const { data: siteInfo } = await supabase
        .from('sites').select('build_type, inquiry_id').eq('site_id', siteId).maybeSingle()

      if (siteInfo?.build_type === 'managed') {
        // 루트 B: 관리자 미리보기 배포 — deploy_status도 live, trial 없음
        await supabase.from('sites')
          .update({ status: 'published', deploy_status: 'live', updated_at: now.toISOString() })
          .eq('site_id', siteId)
        if (siteInfo.inquiry_id) {
          await supabase.from('inquiries')
            .update({ status: 'review', updated_at: now.toISOString() })
            .eq('inquiry_id', siteInfo.inquiry_id)
        }
      } else {
        // 루트 A: self 사이트 — pending 구독이 있으면 trial 시작
        await supabase.from('sites')
          .update({ status: 'published', updated_at: now.toISOString() })
          .eq('site_id', siteId)
        const { data: sub } = await supabase
          .from('subscriptions').select('subscription_id, status').eq('site_id', siteId).maybeSingle()
        if (sub?.status === 'pending') {
          const trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
          const nextBilling = new Date(trialEnds)
          nextBilling.setMonth(nextBilling.getMonth() + 1)
          await supabase.from('subscriptions').update({
            status: 'trial',
            next_billing_date: nextBilling.toISOString().split('T')[0],
            updated_at: now.toISOString(),
          }).eq('subscription_id', sub.subscription_id)
          await supabase.from('sites').update({
            trial_started_at: now.toISOString(),
            trial_ends_at: trialEnds.toISOString(),
          }).eq('site_id', siteId)
        }
      }
    } else {
      await supabase.from('sites').update({ status, updated_at: now.toISOString() }).eq('site_id', siteId)

      if (status === 'suspended') {
        // 관리자 정지: 연결된 구독도 paused로 변경
        await supabase.from('subscriptions')
          .update({ status: 'paused', updated_at: now.toISOString() })
          .eq('site_id', siteId)
          .in('status', ['active', 'trial'])
      }
    }

    fetchAll()
  }

  async function deleteSite(site) {
    if (site.status !== 'draft') {
      alert('draft 상태인 사이트만 삭제할 수 있습니다.')
      return
    }
    if (!window.confirm(`"${site.name}" 사이트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return

    // 구독 존재 여부 확인
    const { data: sub } = await supabase
      .from('subscriptions').select('subscription_id').eq('site_id', site.site_id).maybeSingle()
    if (sub) {
      alert('구독이 연결된 사이트는 삭제할 수 없습니다.')
      return
    }

    const { error } = await supabase.from('sites').delete().eq('site_id', site.site_id)
    if (error) {
      alert('삭제 실패: ' + error.message)
    } else {
      setMessage('🗑️ 사이트가 삭제되었습니다.')
      fetchAll()
    }
  }

  async function updateTicketStatus(ticketId, status) {
    const update = { status }
    if (status === 'resolved') update.resolved_at = new Date().toISOString()
    await supabase.from('support_tickets').update(update).eq('ticket_id', ticketId)
    fetchAll()
  }

  // trial/active 구독 중 next_billing_date 도래한 것 결제 처리
  async function handleProcessBilling() {
    const today = new Date().toISOString().split('T')[0]

    const { data: due } = await supabase
      .from('subscriptions')
      .select('subscription_id, site_id, customer_id, next_billing_date, status')
      .in('status', ['trial', 'active'])
      .lte('next_billing_date', today)
      .eq('payment_method', 'card')

    if (!due?.length) { setMessage('청구할 구독이 없습니다.'); return }

    for (const sub of due) {
      const period = sub.next_billing_date.slice(0, 7) // 'YYYY-MM'
      const nextDate = new Date(sub.next_billing_date)
      nextDate.setMonth(nextDate.getMonth() + 1)
      const nextBillingDate = nextDate.toISOString().split('T')[0]

      // billing_history 기록
      await supabase.from('billing_history').upsert({
        subscription_id: sub.subscription_id,
        period,
        amount: 30000,
        status: 'paid',
        payment_method: 'card',
        paid_at: new Date().toISOString(),
        note: '[MOCK] 자동 카드 결제',
      }, { onConflict: 'subscription_id,period' })

      // 구독 상태 → active, 다음 청구일 +1달
      await supabase.from('subscriptions').update({
        status: 'active',
        next_billing_date: nextBillingDate,
        updated_at: new Date().toISOString(),
      }).eq('subscription_id', sub.subscription_id)
    }

    setMessage(`✅ ${due.length}건 결제 처리 완료`)
    fetchAll()
  }

  // 만료된 구독 일괄 처리: cancels_at 지났는데 아직 active인 구독 → cancelled
  async function handleProcessExpired() {
    const now = new Date().toISOString()

    // 조건: 해지 예정일 경과 + 아직 cancelled 아님 + 해지 예약 있음
    const { data: expired } = await supabase
      .from('subscriptions')
      .select('subscription_id, site_id')
      .lt('cancels_at', now)
      .neq('status', 'cancelled')
      .not('cancels_at', 'is', null)

    if (!expired?.length) { setMessage('만료된 구독이 없습니다.'); return }

    for (const sub of expired) {
      await supabase.from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('subscription_id', sub.subscription_id)
      await supabase.from('sites')
        .update({ status: 'cancelled', updated_at: now })
        .eq('site_id', sub.site_id)
    }
    setMessage(`✅ ${expired.length}건 처리 완료`)
    fetchAll()
  }

  // 구독 행 클릭 → 납부 내역 펼치기/접기
  async function toggleExpand(subId) {
    if (expandedSubId === subId) {
      setExpandedSubId(null)
      return
    }
    setExpandedSubId(subId)
    // 아직 로드 안 된 경우만 조회
    if (!billingHistory[subId]) {
      const { data } = await supabase
        .from('billing_history')
        .select('*')
        .eq('subscription_id', subId)
        .order('period', { ascending: false })
      setBillingHistory(prev => ({ ...prev, [subId]: data || [] }))
    }
  }

  // 납부 확인: billing_history upsert + next_billing_date +1달 (수동결제)
  async function markBillingPaid(subId, amount, period, paymentMethod) {
    try {
      // 기존 레코드 확인 (maybeSingle: 없어도 에러 안 남)
      const { data: existing } = await supabase
        .from('billing_history')
        .select('billing_id, status')
        .eq('subscription_id', subId)
        .eq('period', period)
        .maybeSingle()

      if (existing?.status === 'paid') {
        setMessage('이미 납부 확인된 내역입니다.')
        return
      }

      const now = new Date().toISOString()
      if (existing) {
        await supabase.from('billing_history')
          .update({ status: 'paid', paid_at: now })
          .eq('billing_id', existing.billing_id)
      } else {
        await supabase.from('billing_history').insert([{
          subscription_id: subId, period, amount,
          status: 'paid', payment_method: paymentMethod || 'manual', paid_at: now,
        }])
      }

      // 수동결제는 next_billing_date를 현재 +1달로 갱신
      if (!paymentMethod || paymentMethod === 'manual') {
        const next = new Date()
        next.setMonth(next.getMonth() + 1)
        await supabase.from('subscriptions')
          .update({ next_billing_date: next.toISOString().split('T')[0] })
          .eq('subscription_id', subId)
      }

      setMessage(`✅ ${period} 납부 확인 완료`)
      // 펼쳐진 내역 새로고침
      const { data: updated } = await supabase
        .from('billing_history')
        .select('*')
        .eq('subscription_id', subId)
        .order('period', { ascending: false })
      setBillingHistory(prev => ({ ...prev, [subId]: updated || [] }))
      fetchAll()
    } catch (err) {
      setMessage('❌ 오류: ' + err.message)
    }
  }

  // 문의 상태 업데이트
  async function updateInquiryStatus(inquiryId, status) {
    await supabase.from('inquiries')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('inquiry_id', inquiryId)
    fetchAll()
  }

  // 견적 금액 저장
  async function saveDevFee(inquiryId, amount) {
    const num = parseInt(amount, 10)
    if (isNaN(num) || num <= 0) { alert('올바른 금액을 입력해주세요.'); return }
    await supabase.from('inquiries')
      .update({ dev_fee_total: num, updated_at: new Date().toISOString() })
      .eq('inquiry_id', inquiryId)
    fetchAll()
  }

  // 선금 50% 확인 → building으로 전환
  async function confirmDownPayment(inquiryId) {
    if (!window.confirm('선금 50% 납부를 확인하셨나요?\n상태가 "제작중"으로 변경됩니다.')) return
    await supabase.from('inquiries')
      .update({ down_paid_at: new Date().toISOString(), status: 'building', updated_at: new Date().toISOString() })
      .eq('inquiry_id', inquiryId)
    fetchAll()
  }

  // 잔금 50% 확인 → approved로 전환
  async function confirmFinalPayment(inquiryId) {
    if (!window.confirm('잔금 50% 납부를 확인하셨나요?\n상태가 "고객승인완료"로 변경됩니다.')) return
    await supabase.from('inquiries')
      .update({ final_paid_at: new Date().toISOString(), status: 'approved', updated_at: new Date().toISOString() })
      .eq('inquiry_id', inquiryId)
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
                    {loading ? '생성 중...' : '사이트 개설'}
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
                            {site.status === 'draft' && btn('#9ca3af', '삭제', () => deleteSite(site))}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>
                구독 현황 — 이번달 예상 ₩{(activeSubCount * 30000).toLocaleString()}
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* next_billing_date 도래한 구독 자동 결제 */}
                <button onClick={handleProcessBilling}
                  style={{ fontSize: 12, padding: '6px 14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                  청구 처리
                </button>
                {/* 해지 예정일 지난 구독 일괄 cancelled 처리 */}
                <button onClick={handleProcessExpired}
                  style={{ fontSize: 12, padding: '6px 14px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                  만료 구독 처리
                </button>
              </div>
            </div>
            <div className="overflow-x-auto -mx-6 px-6">
            <table style={css.table}>
              <thead>
                <tr>{['고객', '사이트', '월 구독료', '결제방식', '다음 청구일', '상태', '서비스 종료일', '이번달 납부'].map(h =>
                  <th key={h} style={{ ...css.th, whiteSpace: 'nowrap' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {subscriptions.map(sub => {
                  const isExpanded = expandedSubId === sub.subscription_id
                  const history = billingHistory[sub.subscription_id] || []
                  const COLS = 8

                  return (
                    <React.Fragment key={sub.subscription_id}>
                      {/* 메인 행 — 클릭하면 납부 내역 펼침 */}
                      <tr
                        onClick={() => toggleExpand(sub.subscription_id)}
                        style={{ cursor: 'pointer', background: isExpanded ? '#0f172a' : 'transparent' }}>
                        <td style={css.td}>
                          <span style={{ marginRight: 6, color: '#475569', fontSize: 11 }}>
                            {isExpanded ? '▼' : '▶'}
                          </span>
                          {sub.customers?.name}
                        </td>
                        <td style={css.td}>{sub.sites?.site_name}</td>
                        <td style={css.td}>₩{sub.amount?.toLocaleString()}</td>
                        <td style={css.td}>
                          {badge(sub.payment_method === 'card' ? '#22c55e' : '#f59e0b',
                            sub.payment_method === 'card' ? '카드' : '수동')}
                        </td>
                        <td style={css.td}>{sub.next_billing_date || '-'}</td>
                        <td style={css.td}>
                          {badge(sub.status === 'active' ? '#22c55e' : sub.status === 'trial' ? '#f59e0b' : '#6b7280', sub.status)}
                        </td>
                        {/* 해지 예약된 경우 cancels_at 표시, 아니면 - */}
                        <td style={{ ...css.td, color: sub.cancels_at ? '#ef4444' : '#475569' }}>
                          {sub.cancels_at ? new Date(sub.cancels_at).toLocaleDateString('ko-KR') : '-'}
                        </td>
                        <td style={css.td} />
                      </tr>

                      {/* 펼침 행 — 월별 납부 내역 + 납부 확인 버튼 */}
                      {isExpanded && (
                        <tr key={sub.subscription_id + '_detail'}>
                          <td colSpan={COLS} style={{ padding: 0, background: '#080810' }}>
                            <div style={{ padding: '12px 32px 16px' }}>
                              <table style={{ ...css.table, fontSize: 12 }}>
                                <thead>
                                  <tr>
                                    {['기간', '금액', '상태', '결제방식', '납부일', '처리'].map(h => (
                                      <th key={h} style={{ ...css.th, fontSize: 10, padding: '6px 10px' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {history.length === 0 ? (
                                    <tr>
                                      <td colSpan={6} style={{ ...css.td, color: '#334155', fontSize: 12, textAlign: 'center', padding: '10px' }}>
                                        납부 내역이 없습니다
                                      </td>
                                    </tr>
                                  ) : history.map(bh => (
                                    <tr key={bh.billing_id}>
                                      <td style={{ ...css.td, padding: '8px 10px', fontFamily: 'monospace' }}>{bh.period}</td>
                                      <td style={{ ...css.td, padding: '8px 10px' }}>₩{bh.amount?.toLocaleString()}</td>
                                      <td style={{ ...css.td, padding: '8px 10px' }}>
                                        {badge(
                                          bh.status === 'paid' ? '#22c55e' : bh.status === 'overdue' ? '#ef4444' : '#f59e0b',
                                          bh.status === 'paid' ? '납부완료' : bh.status === 'overdue' ? '연체' : '미납'
                                        )}
                                      </td>
                                      <td style={{ ...css.td, padding: '8px 10px', color: '#64748b' }}>
                                        {bh.payment_method === 'card' ? '카드' : '수동'}
                                      </td>
                                      <td style={{ ...css.td, padding: '8px 10px', color: '#64748b' }}>
                                        {bh.paid_at ? new Date(bh.paid_at).toLocaleDateString('ko-KR') : '-'}
                                      </td>
                                      <td style={{ ...css.td, padding: '8px 10px' }}>
                                        {bh.status !== 'paid' && btn('#16a34a', '납부 확인',
                                          e => { e.stopPropagation(); markBillingPaid(sub.subscription_id, bh.amount, bh.period, bh.payment_method) }
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {/* 이번달 기록이 없으면 신규 납부 확인 버튼 노출 */}
                              {!history.some(bh => bh.period === currentPeriod) && (
                                <div style={{ marginTop: 10 }}>
                                  {btn('#2563eb', `+ ${currentPeriod} 납부 확인`,
                                    e => { e.stopPropagation(); markBillingPaid(sub.subscription_id, sub.amount, currentPeriod, sub.payment_method) }
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
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

        {/* ── 탭 4: 제작 문의 ── */}
        {tab === 4 && (() => {
          const INQUIRY_STATUS = {
            received: { label: '접수',       color: '#f59e0b' },
            reviewing:{ label: '검토/견적',  color: '#60a5fa' },
            building: { label: '제작중',     color: '#a78bfa' },
            review:   { label: '검수대기',   color: '#f97316' },
            approved: { label: '잔금완료',   color: '#06b6d4' },
            done:     { label: '배포완료',   color: '#22c55e' },
          }
          const BIZ_LABEL = {
            cafe: '☕ 카페', restaurant: '🍽 식당', salon: '💇 미용실',
            clinic: '🏥 병원', academy: '📚 학원', general: '🏪 일반', etc: '🏪 기타',
          }
          const pendingInquiries = inquiries.filter(i => i.status !== 'done').length

          return (
            <div style={css.card}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>
                제작 문의 — {pendingInquiries}건 대기중
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {inquiries.length === 0 && (
                  <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>접수된 문의가 없습니다</div>
                )}
                {inquiries.map(inq => {
                  const st = INQUIRY_STATUS[inq.status] || INQUIRY_STATUS.received
                  const localFee = inquiryDevFee[inq.inquiry_id] ?? (inq.dev_fee_total ? String(inq.dev_fee_total) : '')
                  return (
                    <div key={inq.inquiry_id} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '16px 20px' }}>
                      {/* 헤더 행 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 14 }}>
                          {inq.customers?.name}
                          <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>{inq.customers?.email}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{inq.phone || inq.customers?.phone || '-'}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{BIZ_LABEL[inq.business_type] || '-'}</div>
                        {badge(st.color, st.label)}
                        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>
                          {new Date(inq.created_at).toLocaleDateString('ko-KR')} 접수
                        </div>
                      </div>

                      {/* 요청 내용 */}
                      {inq.description && (
                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, lineHeight: 1.6, borderLeft: '2px solid #334155', paddingLeft: 10 }}>
                          {inq.description}
                        </div>
                      )}

                      {/* 개발비 / 납부 현황 */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>총 개발비:</span>
                        <input
                          type="number"
                          value={localFee}
                          onChange={e => setInquiryDevFee(f => ({ ...f, [inq.inquiry_id]: e.target.value }))}
                          placeholder="견적 금액 입력"
                          style={{ width: 130, padding: '4px 8px', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', fontSize: 12 }}
                        />
                        <span style={{ fontSize: 12, color: '#64748b' }}>원</span>
                        {btn('#334155', '저장', () => saveDevFee(inq.inquiry_id, localFee))}
                        {inq.dev_fee_total && (
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>
                            선금 {(inq.dev_fee_total / 2).toLocaleString()}원 / 잔금 {(inq.dev_fee_total / 2).toLocaleString()}원
                          </span>
                        )}
                      </div>

                      {/* 납부 확인 현황 */}
                      <div style={{ display: 'flex', gap: 6, fontSize: 11, color: '#64748b', marginBottom: 12 }}>
                        <span style={{ color: inq.down_paid_at ? '#22c55e' : '#475569' }}>
                          선금 {inq.down_paid_at ? `✓ ${new Date(inq.down_paid_at).toLocaleDateString('ko-KR')}` : '미확인'}
                        </span>
                        <span style={{ color: '#334155' }}>·</span>
                        <span style={{ color: inq.final_paid_at ? '#22c55e' : '#475569' }}>
                          잔금 {inq.final_paid_at ? `✓ ${new Date(inq.final_paid_at).toLocaleDateString('ko-KR')}` : '미확인'}
                        </span>
                      </div>

                      {/* 액션 버튼 행 */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* 상태 드롭다운 */}
                        <select
                          value={inq.status}
                          onChange={e => updateInquiryStatus(inq.inquiry_id, e.target.value)}
                          style={{ padding: '5px 8px', background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                          <option value="received">접수</option>
                          <option value="reviewing">검토/견적</option>
                          <option value="building">제작중</option>
                          <option value="review">검수대기</option>
                          <option value="approved">잔금완료</option>
                          <option value="done">배포완료</option>
                        </select>

                        {/* 선금 확인 — reviewing 이고 선금 미확인일 때 */}
                        {inq.status === 'reviewing' && !inq.down_paid_at && (
                          btn('#16a34a', '선금 확인', () => confirmDownPayment(inq.inquiry_id))
                        )}

                        {/* 잔금 확인 — building/review이고 잔금 미확인일 때 */}
                        {['building', 'review'].includes(inq.status) && !inq.final_paid_at && (
                          btn('#2563eb', '잔금 확인', () => confirmFinalPayment(inq.inquiry_id))
                        )}

                        {/* 사이트 생성 / 확인 — 이미 사이트가 있으면 "사이트 확인→" */}
                        {(() => {
                          const linkedSite = sites.find(s => s.inquiry_id === inq.inquiry_id)
                          if (linkedSite) {
                            return btn('#334155', `사이트 확인→ (${linkedSite.subdomain})`, () => {
                              setTab(0)
                              setMessage(`ℹ️ ${inq.customers?.name} 고객의 사이트(${linkedSite.subdomain})가 이미 생성되어 있습니다.`)
                            })
                          }
                          if (['building', 'review', 'approved', 'done'].includes(inq.status)) {
                            return btn('#6366f1', '사이트 생성→', () => {
                              setForm(f => ({
                                ...f,
                                customer_name:  inq.customers?.name  || '',
                                customer_email: inq.customers?.email || '',
                                customer_phone: inq.phone || inq.customers?.phone || '',
                                description:    inq.description || '',
                                build_type:     'managed',
                                inquiry_id:     inq.inquiry_id,
                              }))
                              setTab(0)
                              setMessage(`📋 ${inq.customers?.name} 고객 정보를 불러왔습니다. 사이트명과 서브도메인을 입력해주세요.`)
                            })
                          }
                          return <span style={{ fontSize: 11, color: '#475569' }}>선금 확인 후 사이트 생성 가능</span>
                        })()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

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
