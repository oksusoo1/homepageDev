'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isPlatformAdmin } from '@/lib/auth'
import DocsBrowser from '@/components/DocsBrowser'
import PlatformDevTools from '@/components/PlatformDevTools'
import PlatformSiteDetail from '@/components/PlatformSiteDetail'
import PlatformCustomerDetail from '@/components/PlatformCustomerDetail'
import PlatformCommonCodes from '@/components/PlatformCommonCodes'
import { sitePublicPath } from '@/lib/site-paths'
import { getSitePeriodInfo } from '@/lib/site-period'
import { loadCommonCodes, codeLabel, codeColor } from '@/lib/common-codes'
import { onlyActive, softDelete } from '@/lib/use-flag'

const NAV = [
  { key: 'dashboard', label: '대시보드', icon: '📊' },
  { key: 'customers', label: '회원', icon: '👤' },
  { key: 'sites', label: '사이트', icon: '🌐' },
  { key: 'subs', label: '구독', icon: '💳' },
  { key: 'tickets', label: '수정요청', icon: '📝' },
  { key: 'payments', label: '1회성 결제', icon: '💰' },
  { key: 'inquiries', label: '제작 문의', icon: '🏗' },
  { key: 'codes', label: '공통코드', icon: '🏷' },
  { key: 'docs', label: '개발 문서', icon: '📚' },
  { key: 'dev', label: '테스트', icon: '🛠' },
]

export default function AdminConsole() {
  const router = useRouter()
  const [nav, setNav] = useState('dashboard')
  const [sites, setSites] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [tickets, setTickets] = useState([])
  const [oneTimePays, setOneTimePays] = useState([])
  const [inquiries, setInquiries] = useState([])
  const [templates, setTemplates] = useState([])
  const [customers, setCustomers] = useState([])
  const [codesTick, setCodesTick] = useState(0)

  const [expandedSubId, setExpandedSubId] = useState(null)     // 펼쳐진 구독 행
  const [billingHistory, setBillingHistory] = useState({})      // { sub_id: [...records] }
  const [inquiryDevFee, setInquiryDevFee] = useState({})        // { inquiry_id: 금액 } — 견적 편집용
  const [loading, setLoading] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedSiteId, setSelectedSiteId] = useState(null)   // 사이트 상세
  const [selectedCustomerId, setSelectedCustomerId] = useState(null) // 회원 상세
  const [showCreateForm, setShowCreateForm] = useState(false)  // 새 사이트 폼
  const [form, setForm] = useState({
    customer_name: '', customer_email: '', customer_phone: '',
    site_name: '', subdomain: '', description: '',
    address: '', phone: '', email: '',
    template_id: '', build_type: 'self', inquiry_id: '',
  })

  useEffect(() => { checkAdminAuth() }, [])

  async function checkAdminAuth() {
    // isPlatformAdmin → requireAuthUser (세션 우선)
    if (!(await isPlatformAdmin())) {
      router.push('/login')
      return
    }
    setAuthChecked(true)
    fetchAll()
  }

  async function fetchAll() {
    const [s, sub, t, otp, tmpl, inq, cust] = await Promise.all([
      onlyActive(supabase.from('sites').select('*, customers(name, email, phone)')).order('created_at', { ascending: false }),
      onlyActive(supabase.from('subscriptions').select('*, sites(site_name:name, subdomain), customers(name)')).order('created_at', { ascending: false }),
      onlyActive(supabase.from('support_tickets').select('*, sites(name), customers(name)')).order('created_at', { ascending: false }),
      onlyActive(supabase.from('one_time_payments').select('*, customers(name), sites(name)')).order('created_at', { ascending: false }),
      onlyActive(supabase.from('templates').select('*').eq('is_active', true)).order('sort_order'),
      onlyActive(supabase.from('inquiries').select('*, customers(name, email, phone)')).order('created_at', { ascending: false }),
      onlyActive(supabase.from('customers').select('*')).order('created_at', { ascending: false }),
    ])
    setSites(s.data || [])
    setSubscriptions(sub.data || [])
    setTickets(t.data || [])
    setOneTimePays(otp.data || [])
    setTemplates(tmpl.data || [])
    setInquiries(inq.data || [])
    setCustomers(cust.data || [])
    try {
      await loadCommonCodes({ force: true })
      setCodesTick(t => t + 1)
    } catch (e) {
      console.warn('common codes load failed', e)
    }
  }

  useEffect(() => {
    function onApplied() { setCodesTick(t => t + 1) }
    window.addEventListener('common-codes-applied', onApplied)
    return () => window.removeEventListener('common-codes-applied', onApplied)
  }, [])

  async function createSite(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      // 1. 기존 고객 조회 → 없으면 신규 생성
      let customer
      const { data: existing } = await onlyActive(
        supabase.from('customers').select('*').eq('email', form.customer_email)
      ).maybeSingle()

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
      setShowCreateForm(false)
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

    if (status === 'published' || status === 'review') {
      const { data: siteInfo } = await onlyActive(
        supabase.from('sites').select('build_type, inquiry_id').eq('site_id', siteId)
      ).maybeSingle()

      if (siteInfo?.build_type === 'managed') {
        const targetStatus = status === 'review' ? 'review' : 'published'
        await supabase.from('sites')
          .update({ status: targetStatus, deploy_status: 'live', updated_at: now.toISOString() })
          .eq('site_id', siteId)
          .eq('use_flag', 1)
        if (siteInfo.inquiry_id) {
          await supabase.from('inquiries')
            .update({ status: 'review', updated_at: now.toISOString() })
            .eq('inquiry_id', siteInfo.inquiry_id)
            .eq('use_flag', 1)
        }
      } else {
        // 루트 A: self 사이트 — pending 구독이 있으면 trial 시작
        await supabase.from('sites')
          .update({ status: 'published', updated_at: now.toISOString() })
          .eq('site_id', siteId)
          .eq('use_flag', 1)
        const { data: sub } = await onlyActive(
          supabase.from('subscriptions').select('subscription_id, status').eq('site_id', siteId)
        ).maybeSingle()
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
    if (!window.confirm(
      `"${site.name}" 를 삭제(use_flag=0) 처리할까요?\n데이터는 남고 목록에서만 숨깁니다.\n복구는 DB에서 sites.use_flag=1 로 가능합니다.`
    )) return

    try {
      await softDelete(supabase, 'sites', 'site_id', site.site_id)
      setMessage('🗑️ 사이트 use_flag=0 (목록에서 숨김)')
      if (selectedSiteId === site.site_id) setSelectedSiteId(null)
      fetchAll()
    } catch (err) {
      alert('삭제 실패: ' + err.message)
      throw err
    }
  }

  async function saveSiteFields(siteId, patch) {
    const { error } = await supabase
      .from('sites')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('site_id', siteId)
    if (error) throw new Error(error.message)
    setMessage('✅ 사이트 정보가 저장되었습니다.')
    await fetchAll()
  }

  async function saveCustomerFields(customerId, patch) {
    const { error } = await supabase
      .from('customers')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('customer_id', customerId)
    if (error) throw new Error(error.message)
    setMessage('✅ 회원 정보가 저장되었습니다.')
    await fetchAll()
  }

  async function deleteCustomer(customer) {
    if (!window.confirm(
      `"${customer.name}" (${customer.email}) 를 삭제(use_flag=0) 처리할까요?\n회원은 목록에서 숨겨집니다. 보유 사이트는 그대로입니다.`
    )) return
    try {
      await softDelete(supabase, 'customers', 'customer_id', customer.customer_id)
      setMessage('🗑️ 회원 use_flag=0 (목록에서 숨김)')
      if (selectedCustomerId === customer.customer_id) setSelectedCustomerId(null)
      fetchAll()
    } catch (err) {
      alert('삭제 실패: ' + err.message)
      throw err
    }
  }

  function openCustomerDetail(customerId) {
    setSelectedCustomerId(customerId)
    setSelectedSiteId(null)
    setNav('customers')
  }

  function openSiteDetail(siteId) {
    setSelectedSiteId(siteId)
    setSelectedCustomerId(null)
    setNav('sites')
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

  // 계좌이체 미납 +2일 → 연체·정지
  async function handleProcessOverdue() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data: subs } = await supabase
      .from('subscriptions')
      .select('subscription_id, site_id, next_billing_date')
      .eq('payment_method', 'manual')
      .in('status', ['trial', 'active'])

    let count = 0
    for (const sub of subs || []) {
      if (!sub.next_billing_date) continue
      const graceEnd = new Date(sub.next_billing_date)
      graceEnd.setDate(graceEnd.getDate() + 2)
      if (today <= graceEnd) continue

      const period = sub.next_billing_date.slice(0, 7)
      const { data: bh } = await supabase
        .from('billing_history')
        .select('status')
        .eq('subscription_id', sub.subscription_id)
        .eq('period', period)
        .maybeSingle()
      if (bh?.status === 'paid') continue

      await supabase.from('billing_history').upsert({
        subscription_id: sub.subscription_id,
        period,
        amount: 30000,
        status: 'overdue',
        payment_method: 'manual',
        due_at: sub.next_billing_date,
      }, { onConflict: 'subscription_id,period' })

      await supabase.from('sites')
        .update({ status: 'suspended', updated_at: new Date().toISOString() })
        .eq('site_id', sub.site_id)
      count++
    }

    setMessage(count ? `✅ ${count}건 연체 정지 처리` : '연체 정지 대상이 없습니다.')
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
  async function markBillingPaid(subId, siteId, amount, period, paymentMethod) {
    try {
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

      if (!paymentMethod || paymentMethod === 'manual') {
        const next = new Date()
        next.setMonth(next.getMonth() + 1)
        await supabase.from('subscriptions')
          .update({ next_billing_date: next.toISOString().split('T')[0], status: 'active' })
          .eq('subscription_id', subId)
      }

      if (siteId) {
        await supabase.from('sites')
          .update({ status: 'published', updated_at: now })
          .eq('site_id', siteId)
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
    const now = new Date().toISOString()
    const { data: inq } = await supabase
      .from('inquiries').select('customer_id').eq('inquiry_id', inquiryId).maybeSingle()
    await supabase.from('inquiries')
      .update({ final_paid_at: now, status: 'approved', updated_at: now })
      .eq('inquiry_id', inquiryId)
    if (inq?.customer_id) {
      await supabase.from('one_time_payments')
        .update({ status: 'paid', paid_at: now })
        .eq('customer_id', inq.customer_id)
        .eq('type', 'dev_fee')
        .in('status', ['unpaid', 'pending_confirm'])
    }
    fetchAll()
  }

  /**
   * 1회성결제 「납부확인」
   * - domain_setup / extra: OTP만 paid
   * - dev_fee(잔금): OTP + inquiries(final_paid_at, approved) 동시 반영 → /my 가 5단계로 넘어감
   */
  async function markOneTimePaid(paymentId) {
    const pay = oneTimePays.find(p => p.payment_id === paymentId)
    const now = new Date().toISOString()

    if (pay?.type === 'dev_fee') {
      if (!window.confirm('개발비 잔금 납부를 확인할까요?\n문의가 「서비스 시작 준비」로 바뀌고 고객 /my 에도 반영됩니다.')) return
    }

    const { error } = await supabase.from('one_time_payments')
      .update({ status: 'paid', paid_at: now })
      .eq('payment_id', paymentId)
    if (error) { alert(error.message); return }

    if (pay?.type === 'dev_fee' && pay.customer_id) {
      let inquiryId = null
      if (pay.site_id) {
        const site = sites.find(s => s.site_id === pay.site_id)
        inquiryId = site?.inquiry_id || null
      }
      if (!inquiryId) {
        const candidate = inquiries.find(i =>
          i.customer_id === pay.customer_id &&
          !i.final_paid_at &&
          ['building', 'review'].includes(i.status)
        )
        inquiryId = candidate?.inquiry_id || null
      }
      if (inquiryId) {
        const { error: inqErr } = await supabase.from('inquiries')
          .update({ final_paid_at: now, status: 'approved', updated_at: now })
          .eq('inquiry_id', inquiryId)
        if (inqErr) { alert(inqErr.message); return }
      } else {
        alert('결제 행은 납부완료 처리됐지만, 연결 문의를 찾지 못했습니다. 제작 문의에서 「잔금 확인」을 눌러 주세요.')
      }
    }

    fetchAll()
  }

  const currentPeriod = new Date().toISOString().slice(0, 7)
  const activeSubCount = subscriptions.filter(s => s.status === 'active').length
  const pendingTickets = tickets.filter(t => t.status !== 'resolved').length
  const pendingConfirmOtp = oneTimePays.filter(p => p.status === 'pending_confirm')

  function hasPendingDeposit(customerId) {
    return pendingConfirmOtp.some(p => p.customer_id === customerId)
  }

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

  if (!authChecked) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', color: '#9ca3af', fontSize: 14 }}>
      인증 확인 중...
    </div>
  )

  return (
    <div style={{ ...css.page, display: 'flex', minHeight: '100vh' }}>

      {/* 왼쪽 사이드바 */}
      <aside style={{
        width: 220, flexShrink: 0, background: '#0d0d14', borderRight: '1px solid #1e293b',
        display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh',
      }}>
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', letterSpacing: 1.5 }}>MY PLATFORM</span>
          </div>
          <div style={{ fontSize: 11, color: '#475569', paddingLeft: 15 }}>관리자 콘솔</div>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {NAV.map(item => {
            const active = nav === item.key
            let badgeCount = 0
            if (item.key === 'dashboard') badgeCount = pendingConfirmOtp.length + pendingTickets
            if (item.key === 'payments') badgeCount = pendingConfirmOtp.length
            if (item.key === 'tickets') badgeCount = pendingTickets
            if (item.key === 'inquiries') badgeCount = pendingConfirmOtp.length
            return (
              <button
                key={item.key}
                onClick={() => setNav(item.key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', marginBottom: 2, borderRadius: 8, border: 'none',
                  cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: active ? 700 : 500,
                  background: active ? '#1e293b' : 'transparent',
                  color: item.key === 'dev'
                    ? (active ? '#fbbf24' : '#a16207')
                    : (active ? '#f1f5f9' : '#64748b'),
                }}
              >
                <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {badgeCount > 0 && (
                  <span style={{
                    minWidth: 18, height: 18, borderRadius: 9, padding: '0 5px',
                    background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>{badgeCount}</span>
                )}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '12px 18px', borderTop: '1px solid #1e293b', fontSize: 11, color: '#475569' }}>
          회원 {customers.length} · 사이트 {sites.length} · 구독 {activeSubCount}
        </div>
      </aside>

      {/* 메인 */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...css.header, borderBottom: '1px solid #1e293b' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
            {NAV.find(n => n.key === nav)?.label}
          </span>
          {pendingConfirmOtp.length > 0 && (
            <button
              onClick={() => setNav('payments')}
              style={{
                marginLeft: 12, padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: '#f59e0b22', color: '#f59e0b', fontSize: 12, fontWeight: 700,
              }}
            >
              입금확인 대기 {pendingConfirmOtp.length}건
            </button>
          )}
          <div className="ml-auto hidden sm:flex gap-4 text-xs text-gray-500">
            <span>사이트 {sites.length}개</span>
            <span>구독 {activeSubCount}개</span>
          </div>
        </div>

        <div style={{ ...css.content, maxWidth: 1100, width: '100%' }}>

        {/* ── 대시보드 ── */}
        {nav === 'dashboard' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: '전체 사이트', value: sites.length, color: '#60a5fa' },
                { label: '활성 구독', value: activeSubCount, color: '#22c55e' },
                { label: '이번달 예상', value: `₩${(activeSubCount * 30000).toLocaleString()}`, color: '#a78bfa' },
                { label: '처리 필요', value: pendingConfirmOtp.length + pendingTickets, color: (pendingConfirmOtp.length + pendingTickets) > 0 ? '#f59e0b' : '#22c55e' },
              ].map(({ label, value, color }) => (
                <div key={label} style={css.statCard}>
                  <div style={{ fontSize: 11, color: '#475569', marginBottom: 8, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ ...css.card, border: pendingConfirmOtp.length ? '1px solid #f59e0b55' : undefined }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>
                처리 필요
              </h3>
              {pendingConfirmOtp.length === 0 && pendingTickets === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>지금 처리할 항목이 없습니다.</p>
              )}
              {pendingConfirmOtp.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700, marginBottom: 10 }}>
                    잔금·1회성 입금확인 대기 {pendingConfirmOtp.length}건
                  </div>
                  {pendingConfirmOtp.map(pay => (
                    <div key={pay.payment_id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                      padding: '12px 14px', marginBottom: 8, background: '#0f172a',
                      border: '1px solid #f59e0b44', borderRadius: 8,
                    }}>
                      {badge(codeColor('OTP_STATUS', 'pending_confirm'), codeLabel('OTP_STATUS', 'pending_confirm'))}
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{pay.customers?.name}</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{codeLabel('OTP_TYPE', pay.type)} ₩{pay.amount?.toLocaleString()}</span>
                      <span style={{ fontSize: 11, color: '#64748b', flex: 1 }}>{pay.note || ''}</span>
                      {btn('#16a34a', '납부확인', () => markOneTimePaid(pay.payment_id))}
                      {btn('#2563eb', '제작 문의로', () => setNav('inquiries'))}
                    </div>
                  ))}
                </div>
              )}
              {pendingTickets > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: '#60a5fa', fontWeight: 700, marginBottom: 8 }}>
                    미처리 수정요청 {pendingTickets}건
                  </div>
                  <button onClick={() => setNav('tickets')} style={{
                    padding: '8px 14px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
                    borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  }}>수정요청 보기 →</button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── 회원 (customers) ── */}
        {nav === 'customers' && (() => {
          const selectedCustomer = customers.find(c => c.customer_id === selectedCustomerId) || null
          return (
            <>
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>
                  회원 목록 ({customers.length}명)
                  <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 500, color: '#64748b' }}>
                    행 클릭 → 상세 · 보유 사이트
                  </span>
                </h3>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: selectedCustomer ? 'minmax(0, 1.1fr) minmax(320px, 0.9fr)' : '1fr',
                gap: 16,
                alignItems: 'start',
              }}>
                <div style={css.card}>
                  <div className="overflow-x-auto -mx-6 px-6">
                    <table style={css.table}>
                      <thead>
                        <tr>{['이름', '이메일', '연락처', '상태', '사이트', '가입일'].map(h =>
                          <th key={h} style={{ ...css.th, whiteSpace: 'nowrap' }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {customers.map(c => {
                          const siteCount = sites.filter(s => s.customer_id === c.customer_id).length
                          const active = selectedCustomerId === c.customer_id
                          return (
                            <tr
                              key={c.customer_id}
                              onClick={() => setSelectedCustomerId(c.customer_id)}
                              style={{
                                cursor: 'pointer',
                                background: active ? '#1e293b' : 'transparent',
                                outline: active ? '1px solid #334155' : undefined,
                              }}
                            >
                              <td style={css.td}><strong>{c.name}</strong></td>
                              <td style={css.td}>
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>{c.email}</span>
                              </td>
                              <td style={css.td}>{c.phone || '—'}</td>
                              <td style={css.td}>
                                {badge(codeColor('CUSTOMER_STATUS', c.status), codeLabel('CUSTOMER_STATUS', c.status))}
                              </td>
                              <td style={css.td}>{siteCount}개</td>
                              <td style={css.td}>
                                <span style={{ fontSize: 12, color: '#64748b' }}>
                                  {c.created_at ? new Date(c.created_at).toLocaleDateString('ko-KR') : '—'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                        {customers.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ ...css.td, textAlign: 'center', color: '#475569' }}>
                              회원이 없습니다
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedCustomer && (
                  <PlatformCustomerDetail
                    customer={selectedCustomer}
                    sites={sites}
                    inquiries={inquiries}
                    subscriptions={subscriptions}
                    oneTimePays={oneTimePays}
                    onClose={() => setSelectedCustomerId(null)}
                    onOpenSite={openSiteDetail}
                    onSave={saveCustomerFields}
                    onSoftDelete={deleteCustomer}
                  />
                )}
              </div>
            </>
          )
        })()}

        {/* ── 사이트 ── */}
        {nav === 'sites' && (() => {
          const selectedSite = sites.find(s => s.site_id === selectedSiteId) || null
          const selectedInquiry = selectedSite?.inquiry_id
            ? inquiries.find(i => i.inquiry_id === selectedSite.inquiry_id)
            : inquiries.find(i => i.customer_id === selectedSite?.customer_id) || null
          const selectedSub = selectedSite
            ? subscriptions.find(s => s.site_id === selectedSite.site_id) || null
            : null
          const selectedOtps = selectedSite
            ? oneTimePays.filter(p =>
              p.site_id === selectedSite.site_id ||
              (p.customer_id === selectedSite.customer_id && p.type === 'dev_fee')
            )
            : []

          return (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>
                  사이트 목록 ({sites.length}개)
                  <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 500, color: '#64748b' }}>
                    행을 클릭하면 흐름·돈 상태를 봅니다
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(v => !v)}
                  style={{
                    padding: '8px 14px', background: showCreateForm ? '#1e293b' : '#2563eb',
                    color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer',
                    fontSize: 13, fontWeight: 700,
                  }}
                >
                  {showCreateForm ? '개설 폼 닫기' : '+ 새 사이트'}
                </button>
              </div>

              {showCreateForm && (
                <div style={css.card}>
                  <h3 style={{ margin: '0 0 20px', fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>+ 새 사이트 개설</h3>
                  <form onSubmit={createSite}>
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
                          <option value="self">{codeLabel('BUILD_TYPE', 'self')} (루트 A)</option>
                          <option value="managed">{codeLabel('BUILD_TYPE', 'managed')} (루트 B)</option>
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
              )}

              <div style={{
                display: 'grid',
                gridTemplateColumns: selectedSite ? 'minmax(0, 1.1fr) minmax(320px, 0.9fr)' : '1fr',
                gap: 16,
                alignItems: 'start',
              }}>
                <div style={css.card} key={`sites-list-${codesTick}`}>
                  <div className="overflow-x-auto -mx-6 px-6">
                    <table style={css.table}>
                      <thead>
                        <tr>{['사이트명', '고객', '유형', '기간', '상태'].map(h =>
                          <th key={h} style={{ ...css.th, whiteSpace: 'nowrap' }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {sites.map(site => {
                          const sub = subscriptions.find(s => s.site_id === site.site_id) || null
                          const period = getSitePeriodInfo(site, sub)
                          const periodBadge = (
                            <div>
                              {badge(period.color, period.label)}
                              {period.subLabel && (
                                <div style={{ marginTop: 4, fontSize: 10, color: '#94a3b8' }}>{period.subLabel}</div>
                              )}
                            </div>
                          )
                          const active = selectedSiteId === site.site_id
                          return (
                            <tr
                              key={site.site_id}
                              onClick={() => setSelectedSiteId(site.site_id)}
                              style={{
                                cursor: 'pointer',
                                background: active ? '#1e293b' : 'transparent',
                                outline: active ? '1px solid #334155' : undefined,
                              }}
                            >
                              <td style={css.td}>
                                <strong>{site.name}</strong><br />
                                <span style={{ fontSize: 11, color: '#64748b' }}>{site.subdomain}</span>
                              </td>
                              <td style={css.td}>
                                {site.customers?.name}<br />
                                <span style={{ fontSize: 11, color: '#64748b' }}>{site.customers?.email}</span>
                              </td>
                              <td style={css.td}>
                                {badge(codeColor('BUILD_TYPE', site.build_type),
                                  codeLabel('BUILD_TYPE', site.build_type))}
                              </td>
                              <td style={css.td}>{periodBadge}</td>
                              <td style={css.td}>
                                {badge(codeColor('SITE_STATUS', site.status), codeLabel('SITE_STATUS', site.status))}
                                {hasPendingDeposit(site.customer_id) && (
                                  <div style={{ marginTop: 4 }}>{badge('#f59e0b', '잔금신청')}</div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedSite && (
                  <PlatformSiteDetail
                    site={selectedSite}
                    inquiry={selectedInquiry}
                    subscription={selectedSub}
                    oneTimePays={selectedOtps}
                    onClose={() => setSelectedSiteId(null)}
                    onStatusAction={updateSiteStatus}
                    onConfirmFinal={confirmFinalPayment}
                    onGoInquiries={() => setNav('inquiries')}
                    onGoPayments={() => setNav('payments')}
                    onGoCustomer={openCustomerDetail}
                    onSave={saveSiteFields}
                    onDelete={deleteSite}
                  />
                )}
              </div>
            </>
          )
        })()}

        {/* ── 탭 1: 구독 현황 ── */}
        {nav === 'subs' && (
          <div style={css.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>
                구독 현황 — 이번달 예상 ₩{(activeSubCount * 30000).toLocaleString()}
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* next_billing_date 도래한 구독 자동 결제 */}
                <button onClick={handleProcessBilling}
                  style={{ fontSize: 12, padding: '6px 14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                  청구 처리 (카드)
                </button>
                <button onClick={handleProcessOverdue}
                  style={{ fontSize: 12, padding: '6px 14px', background: '#b45309', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                  이체 연체 정지
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
                          {badge(codeColor('PAYMENT_METHOD', sub.payment_method),
                            codeLabel('PAYMENT_METHOD', sub.payment_method))}
                        </td>
                        <td style={css.td}>{sub.next_billing_date || '-'}</td>
                        <td style={css.td}>
                          {badge(codeColor('SUB_STATUS', sub.status), codeLabel('SUB_STATUS', sub.status))}
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
                                          codeColor('BILLING_STATUS', bh.status),
                                          codeLabel('BILLING_STATUS', bh.status)
                                        )}
                                      </td>
                                      <td style={{ ...css.td, padding: '8px 10px', color: '#64748b' }}>
                                        {codeLabel('PAYMENT_METHOD', bh.payment_method)}
                                      </td>
                                      <td style={{ ...css.td, padding: '8px 10px', color: '#64748b' }}>
                                        {bh.paid_at ? new Date(bh.paid_at).toLocaleDateString('ko-KR') : '-'}
                                      </td>
                                      <td style={{ ...css.td, padding: '8px 10px' }}>
                                        {bh.status !== 'paid' && btn('#16a34a', '납부 확인',
                                          e => { e.stopPropagation(); markBillingPaid(sub.subscription_id, sub.site_id, bh.amount, bh.period, bh.payment_method) }
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
                                    e => { e.stopPropagation(); markBillingPaid(sub.subscription_id, sub.site_id, sub.amount, currentPeriod, sub.payment_method) }
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
        {nav === 'tickets' && (
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
                      <td style={css.td}>{codeLabel('TICKET_CATEGORY', t.category, t.category || '-')}</td>
                      <td style={css.td}>
                        {badge(
                          codeColor('TICKET_PRIORITY', t.priority),
                          codeLabel('TICKET_PRIORITY', t.priority)
                        )}
                      </td>
                      <td style={css.td}>
                        {badge(codeColor('TICKET_STATUS', t.status), codeLabel('TICKET_STATUS', t.status))}
                      </td>
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
        {nav === 'inquiries' && (() => {
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
                  const localFee = inquiryDevFee[inq.inquiry_id] ?? (inq.dev_fee_total ? String(inq.dev_fee_total) : '')
                  return (
                    <div key={inq.inquiry_id} style={{
                      background: '#0f172a',
                      border: hasPendingDeposit(inq.customer_id) ? '1px solid #f59e0b66' : '1px solid #1e293b',
                      borderRadius: 10, padding: '16px 20px',
                    }}>
                      {hasPendingDeposit(inq.customer_id) && (
                        <div style={{
                          marginBottom: 12, padding: '10px 12px', borderRadius: 8,
                          background: '#f59e0b18', border: '1px solid #f59e0b44',
                          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                        }}>
                          {badge(codeColor('OTP_STATUS', 'pending_confirm'), codeLabel('OTP_STATUS', 'pending_confirm'))}
                          <span style={{ fontSize: 12, color: '#fbbf24', flex: 1 }}>
                            고객이 잔금 입금을 신청했습니다. 통장 확인 후 「잔금 확인」을 눌러 주세요.
                          </span>
                          {!inq.final_paid_at && btn('#2563eb', '잔금 확인', () => confirmFinalPayment(inq.inquiry_id))}
                        </div>
                      )}
                      {/* 헤더 행 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 14 }}>
                          {inq.customers?.name}
                          <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>{inq.customers?.email}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{inq.phone || inq.customers?.phone || '-'}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                          {codeLabel('BUSINESS_TYPE', inq.business_type, '-')}
                        </div>
                        {badge(
                          codeColor('INQUIRY_STATUS', inq.status),
                          codeLabel('INQUIRY_STATUS', inq.status)
                        )}
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
                              setNav('sites')
                              setSelectedSiteId(linkedSite.site_id)
                              setShowCreateForm(false)
                              setMessage(`ℹ️ ${inq.customers?.name} 고객의 사이트(${linkedSite.subdomain}) 상세를 열었습니다.`)
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
                              setNav('sites')
                              setShowCreateForm(true)
                              setSelectedSiteId(null)
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

        {/* ── 탭 5: 개발 문서 ── */}
        {nav === 'codes' && (
          <div style={css.card}>
            <PlatformCommonCodes />
          </div>
        )}

        {nav === 'docs' && (
          <div style={css.card}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>
              개발 문서 — docs/ (플로우 · DB)
            </h3>
            <DocsBrowser />
          </div>
        )}

        {nav === 'dev' && (
          <PlatformDevTools
            sites={sites}
            inquiries={inquiries}
            subscriptions={subscriptions}
            oneTimePays={oneTimePays}
            onRefresh={fetchAll}
          />
        )}

        {/* ── 탭 3: 1회성 결제 ── */}
        {nav === 'payments' && (
          <div style={css.card}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>
              1회성 결제 — 확인대기 {pendingConfirmOtp.length}건 · 미납 {oneTimePays.filter(p => p.status === 'unpaid').length}건
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
                  <tr key={pay.payment_id} style={pay.status === 'pending_confirm' ? { background: '#f59e0b0d' } : undefined}>
                    <td style={css.td}>{pay.customers?.name}</td>
                    <td style={css.td}>{pay.sites?.name || '-'}</td>
                    <td style={css.td}>
                      {badge(codeColor('OTP_TYPE', pay.type), codeLabel('OTP_TYPE', pay.type))}
                    </td>
                    <td style={css.td}>₩{pay.amount?.toLocaleString()}</td>
                    <td style={css.td}>
                      {badge(
                        codeColor('OTP_STATUS', pay.status),
                        codeLabel('OTP_STATUS', pay.status)
                      )}
                    </td>
                    <td style={{ ...css.td, fontSize: 12, color: '#64748b' }}>{pay.note || '-'}</td>
                    <td style={css.td}>
                      {(pay.status === 'unpaid' || pay.status === 'pending_confirm') &&
                        btn('#16a34a', '납부확인', () => markOneTimePaid(pay.payment_id))}
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
    </div>
  )
}
