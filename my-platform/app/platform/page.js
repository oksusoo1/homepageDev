'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DocsBrowser from '@/components/DocsBrowser'
import PlatformDevTools from '@/components/PlatformDevTools'
import PlatformSiteDetail from '@/components/PlatformSiteDetail'
import PlatformCustomerDetail from '@/components/PlatformCustomerDetail'
import PlatformCommonCodes from '@/components/PlatformCommonCodes'
import PlatformListSearch from '@/components/PlatformListSearch'
import PlatformTicketCard from '@/components/PlatformTicketCard'
import { unreadFrom } from '@/lib/support-ticket'
import AuthUserBar from '@/components/AuthUserBar'
import { sitePublicPath, siteAdminPath } from '@/lib/site-paths'
import { getSitePeriodInfo } from '@/lib/site-period'
import { applyCommonCodesCache, codeLabel, codeColor } from '@/lib/common-codes'
import { matchesSearchQuery } from '@/lib/platform-list-search'
import {
  flowStepLabel,
  resolveManagedFlowStep,
  resolveSelfFlowStep,
  resolveHqInquiryAction,
  canOpenHqEditor,
} from '@/lib/flow-step'
import {
  getStaffMe,
  fetchPlatformData,
  createSite as createSiteAction,
  updateSiteStatus as updateSiteStatusAction,
  saveDevFee as saveDevFeeAction,
  confirmDownPayment as confirmDownPaymentAction,
  startDepositStep as startDepositStepAction,
  handleCancelManagedIntake as cancelManagedIntakeAction,
  saveAdminNote as saveAdminNoteAction,
  confirmFinalPayment as confirmFinalPaymentAction,
  deleteSite as deleteSiteAction,
  saveSiteFields as saveSiteFieldsAction,
  saveCustomerFields as saveCustomerFieldsAction,
  deleteCustomer as deleteCustomerAction,
  sendTicketQuote as sendTicketQuoteAction,
  cancelTicketQuote as cancelTicketQuoteAction,
  readTicketMsgs as readTicketMsgsAction,
  addTicketMsg as addTicketMsgAction,
  updateTicket as updateTicketAction,
  markBillingPaid as markBillingPaidAction,
  markOneTimePaid as markOneTimePaidAction,
} from './actions'

/**
 * 본사 콘솔 — 사이트 중심
 * 제작의뢰·1회성결제·구독·청구는 사이트 상세(PlatformSiteDetail)에서 처리
 */
const NAV = [
  { key: 'dashboard', label: '대시보드', icon: '📊' },
  { key: 'sites', label: '사이트', icon: '🌐' },
  { key: 'customers', label: '회원', icon: '👤' },
  { key: 'tickets', label: '고객 요청', icon: '📝' },
  { key: 'dev', label: '개발', icon: '🛠' },
]

const DEV_TABS = [
  { key: 'test', label: '테스트' },
  { key: 'codes', label: '공통코드' },
  { key: 'docs', label: '개발 문서' },
]

/** 사이트 목록 필터 — sites.status(FLOW) 묶음 */
const SITE_FILTERS = [
  { key: 'all', label: '전체', match: () => true },
  { key: 'todo', label: '처리 필요', match: null },
  { key: 'making', label: '제작중', match: s => ['intake', 'deposit', 'building', 'preview', 'balance', 'pay_method'].includes(s.status) },
  { key: 'trial', label: '체험', match: s => s.status === 'trial' },
  { key: 'subscribed', label: '구독', match: s => s.status === 'subscribed' },
  { key: 'suspended', label: '정지', match: s => s.status === 'suspended' },
]

/** 본사가 눌러야 하는 대리제작 단계 액션 */
const HQ_TODO_LABEL = {
  start_deposit: '견적 진행',
  need_fee: '견적 입력',
  confirm_deposit: '선금 확인',
  confirm_balance: '잔금 확인',
}

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
  const [staff, setStaff] = useState(null)
  const [searching, setSearching] = useState(false)
  const [loadedAt, setLoadedAt] = useState(null)
  const [ticketOnlyOpen, setTicketOnlyOpen] = useState(true)
  const [ticketMsgs, setTicketMsgs] = useState({})   // { ticket_id: [메시지] }
  const [ticketQuotes, setTicketQuotes] = useState({}) // { ticket_id: 유료 작업 견적(결제행) }

  const [billings, setBillings] = useState([])                  // billing_history 전체
  const [siteFilter, setSiteFilter] = useState('all')
  const [devTab, setDevTab] = useState('test')
  const [loading, setLoading] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedSiteId, setSelectedSiteId] = useState(null)   // 사이트 상세
  const [selectedCustomerId, setSelectedCustomerId] = useState(null) // 회원 상세
  const [showCreateForm, setShowCreateForm] = useState(false)  // 사이트 개설 모달
  const [siteSearchInput, setSiteSearchInput] = useState('')
  const [siteSearchQuery, setSiteSearchQuery] = useState('')
  const [customerSearchInput, setCustomerSearchInput] = useState('')
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [ticketSearchInput, setTicketSearchInput] = useState('')
  const [ticketSearchQuery, setTicketSearchQuery] = useState('')
  const [form, setForm] = useState({
    customer_id: '', customer_name: '', customer_email: '', customer_phone: '',
    site_name: '', subdomain: '', description: '',
    address: '', phone: '', email: '',
    template_id: '',
  })

  const emptyCreateForm = {
    customer_id: '', customer_name: '', customer_email: '', customer_phone: '',
    site_name: '', subdomain: '', description: '',
    address: '', phone: '', email: '', template_id: '',
  }

  function openCreateModalBlank() {
    setForm({ ...emptyCreateForm })
    setMessage('')
    setShowCreateForm(true)
  }

  function closeCreateModal() {
    setShowCreateForm(false)
    setForm({ ...emptyCreateForm })
  }

  useEffect(() => { checkAdminAuth() }, [])

  useEffect(() => {
    const siteId = new URLSearchParams(window.location.search).get('site')
    if (siteId) { setSelectedSiteId(siteId); setNav('sites') }
  }, [])

  async function checkAdminAuth() {
    const auth = await getStaffMe()
    if (!auth.ok) {
      router.push('/login')
      return
    }
    setStaff(auth.data.staff)
    setAuthChecked(true)
    fetchAll()
  }

  async function fetchAll() {
    const res = await fetchPlatformData()
    if (!res.ok) {
      setMessage('❌ ' + res.error)
      return
    }
    const d = res.data
    setSites(d.sites)
    setSubscriptions(d.subscriptions)
    setTickets(d.tickets)
    setOneTimePays(d.oneTimePays)
    setTemplates(d.templates)
    setInquiries(d.inquiries)
    setCustomers(d.customers)
    setBillings(d.billings)
    setTicketMsgs(d.ticketMsgs)
    setTicketQuotes(d.ticketQuotes)
    setLoadedAt(Date.now())
    applyCommonCodesCache(d.commonCodes)
    setCodesTick(t => t + 1)
  }

  useEffect(() => {
    function onApplied() { setCodesTick(t => t + 1) }
    window.addEventListener('common-codes-applied', onApplied)
    return () => window.removeEventListener('common-codes-applied', onApplied)
  }, [])

  /** 「조회」 = DB에서 다시 읽고 검색어 적용 */
  async function runSearch(apply) {
    setSearching(true)
    apply()
    await fetchAll()
    setSearching(false)
  }

  async function createSite(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const res = await createSiteAction(form)
      if (!res.ok) throw new Error(res.error)
      closeCreateModal()
      setMessage(`✅ 「${res.data.name}」개설됨 · 회원 ${res.data.customerName}`)
      await fetchAll()
      setSelectedSiteId(res.data.site_id)
    } catch (err) {
      setMessage('❌ ' + err.message)
    }
    setLoading(false)
  }

  /** sites.status = FLOW_STEP 설정 */
  async function updateSiteStatus(siteId, flowStep) {
    await updateSiteStatusAction(siteId, flowStep)
    fetchAll()
  }

  // 문의 상태 select 제거됨 — FLOW는 sites.status
  // (updateInquiryStatus 삭제)

  /**
   * 견적 저장 — 개발비 선금·잔금 결제 행(미납)까지 함께 만든다
   * 고객은 /my 에서 단계에 맞는 결제 화면으로 진입
   */
  async function saveDevFee(inquiryId, amount) {
    const res = await saveDevFeeAction(inquiryId, amount)
    if (!res.ok) { setMessage('❌ ' + res.error); return }
    setMessage(res.data.message)
    fetchAll()
  }

  // 선금 확인 → 결제 행 paid + sites.status = building
  async function confirmDownPayment(inquiryId) {
    if (!window.confirm('선금 납부를 확인하셨나요?\n다음 단계: 제작')) return
    const res = await confirmDownPaymentAction(inquiryId)
    if (!res.ok) setMessage('❌ ' + res.error)
    fetchAll()
  }

  // 접수 → 선금 단계
  async function startDepositStep(inquiryId) {
    await startDepositStepAction(inquiryId)
    fetchAll()
  }

  /** 대리 접수 취소 (선금 전) — 문의·사이트 soft delete */
  async function handleCancelManagedIntake(inquiryId) {
    if (!inquiryId) return
    if (!window.confirm('대리 접수를 취소할까요?\n연결된 사이트·문의가 목록에서 삭제됩니다. (선금 확인 전만 가능)')) return
    const res = await cancelManagedIntakeAction(inquiryId)
    if (!res.ok) {
      setMessage('❌ ' + res.error)
      return
    }
    setSelectedSiteId(null)
    setMessage('✅ 대리 접수 취소됨')
    await fetchAll()
  }

  async function saveAdminNote(inquiryId, text) {
    await saveAdminNoteAction(inquiryId, text)
    setMessage('메모 저장됨')
    fetchAll()
  }

  // 잔금 확인 → sites.status = pay_method
  async function confirmFinalPayment(inquiryId) {
    if (!window.confirm('잔금 50% 납부를 확인하셨나요?\n다음: 카드/계좌 등록')) return
    const res = await confirmFinalPaymentAction(inquiryId)
    if (!res.ok) setMessage('❌ ' + res.error)
    fetchAll()
  }

  async function deleteSite(site) {
    if (!window.confirm(
      `"${site.name}" 를 삭제(use_flag=0) 처리할까요?\n데이터는 남고 목록에서만 숨깁니다.\n복구는 DB에서 sites.use_flag=1 로 가능합니다.`
    )) return

    const res = await deleteSiteAction(site.site_id)
    if (!res.ok) {
      alert('삭제 실패: ' + res.error)
      throw new Error(res.error)
    }
    setMessage('🗑️ 사이트 use_flag=0 (목록에서 숨김)')
    if (selectedSiteId === site.site_id) setSelectedSiteId(null)
    fetchAll()
  }

  async function saveSiteFields(siteId, patch) {
    const res = await saveSiteFieldsAction(siteId, patch)
    if (!res.ok) throw new Error(res.error)
    setMessage('✅ 사이트 정보가 저장되었습니다.')
    await fetchAll()
  }

  async function saveCustomerFields(customerId, patch) {
    const res = await saveCustomerFieldsAction(customerId, patch)
    if (!res.ok) throw new Error(res.error)
    setMessage('✅ 회원 정보가 저장되었습니다.')
    await fetchAll()
  }

  async function deleteCustomer(customer) {
    if (!window.confirm(
      `"${customer.name}" (${customer.email}) 를 삭제(use_flag=0) 처리할까요?\n회원은 목록에서 숨겨집니다. 보유 사이트는 그대로입니다.`
    )) return
    const res = await deleteCustomerAction(customer.customer_id)
    if (!res.ok) {
      alert('삭제 실패: ' + res.error)
      throw new Error(res.error)
    }
    setMessage('🗑️ 회원 use_flag=0 (목록에서 숨김)')
    if (selectedCustomerId === customer.customer_id) setSelectedCustomerId(null)
    fetchAll()
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

  /** 유료 작업 견적 — 보내기 / 취소 / 입금 확인 */
  async function sendTicketQuote(ticket, { amount, note }) {
    const res = await sendTicketQuoteAction(ticket, { amount, note })
    if (!res.ok) throw new Error(res.error)
    await fetchAll()
  }

  async function cancelTicketQuote(paymentId) {
    const res = await cancelTicketQuoteAction(paymentId)
    if (!res.ok) throw new Error(res.error)
    await fetchAll()
  }

  /** 요청 카드를 펼치면 사장님 메시지 읽음 처리 */
  async function readTicketMsgs(ticketId) {
    const res = await readTicketMsgsAction(ticketId)
    if (res.ok && res.data.changed) fetchAll()
  }

  /** 고객 요청 대화 — 고객에게 보내기 / 내부 메모 */
  async function addTicketMsg(ticketId, { content, isInternal }) {
    const res = await addTicketMsgAction(ticketId, { content, isInternal })
    if (!res.ok) throw new Error(res.error)
    await fetchAll()
  }

  /** 고객 요청 저장 — 상태·답변·담당자 (PlatformTicketCard 공용) */
  async function updateTicket(ticketId, patch) {
    const res = await updateTicketAction(ticketId, patch)
    if (!res.ok) throw new Error(res.error)
    await fetchAll()
  }

  // 납부 확인: billing_history upsert + next_billing_date +1달 (수동결제)
  async function markBillingPaid(sub, amount, period, paymentMethod) {
    const res = await markBillingPaidAction(sub, amount, period, paymentMethod)
    if (!res.ok) {
      setMessage('❌ 오류: ' + res.error)
      return
    }
    if (res.data.already) {
      setMessage(res.data.message)
      return
    }
    setMessage(res.data.message)
    fetchAll()
  }

  /**
   * 1회성결제 「납부확인」
   * - domain_setup / extra: OTP만 paid
   * - dev_fee(잔금): OTP + final_paid_at + sites.status=pay_method
   */
  async function markOneTimePaid(paymentId) {
    const pay = oneTimePays.find(p => p.payment_id === paymentId)

    if (pay?.type === 'dev_fee') {
      const isDown = pay.stage === 'down'
      const msg = isDown
        ? '개발비 선금 납부를 확인할까요?\n다음: 제작 시작'
        : '개발비 잔금 납부를 확인할까요?\n다음: 카드/계좌 등록'
      if (!window.confirm(msg)) return
    }

    const res = await markOneTimePaidAction(paymentId)
    if (!res.ok) { alert(res.error); return }
    if (res.data?.warn) alert(res.data.warn)
    fetchAll()
  }

  const activeSubCount = subscriptions.filter(s => {
    const site = Array.isArray(s.sites) ? s.sites[0] : s.sites
    return site?.status === 'subscribed' && !s.cancelled_at
  }).length
  const pendingTickets = tickets.filter(t => t.status !== 'resolved').length
  const ticketsNeedReply = (t) => unreadFrom(ticketMsgs[t.ticket_id], 'customer').length > 0
  const pendingConfirmOtp = oneTimePays.filter(p => p.status === 'pending_confirm')

  function hasPendingDeposit(customerId) {
    return pendingConfirmOtp.some(p => p.customer_id === customerId)
  }

  const inquiryOf = (site) => site?.inquiry_id ? inquiries.find(i => i.inquiry_id === site.inquiry_id) || null : null
  const subOf = (site) => subscriptions.find(x => x.site_id === site?.site_id) || null
  /** 사이트의 1회성 결제 — site_id 없는 개발비(잔금 신청)도 대리 사이트에 포함 */
  const otpsOf = (site) => oneTimePays.filter(p =>
    p.site_id === site.site_id || (!p.site_id && p.type === 'dev_fee' && site.inquiry_id && p.customer_id === site.customer_id))
  const billingsOf = (site) => {
    const sub = subOf(site)
    return sub ? billings.filter(bh => bh.subscription_id === sub.subscription_id) : []
  }
  const ticketsOf = (site) => tickets.filter(t => t.site_id === site.site_id)

  /** 본사가 지금 처리할 일 (사이트 단위) */
  function siteTodos(site) {
    const todos = []
    if (site.build_type === 'managed') {
      const inq = inquiryOf(site)
      const finalPending = hasPendingDeposit(site.customer_id) && !inq?.final_paid_at
      const step = resolveManagedFlowStep(inq, { site, finalPending })
      const hq = resolveHqInquiryAction(step, inq, { linkedSite: site, finalPending })
      if (HQ_TODO_LABEL[hq.key]) todos.push({ label: HQ_TODO_LABEL[hq.key], color: '#f59e0b' })
    }
    const otpWaiting = otpsOf(site).filter(p =>
      p.status === 'pending_confirm' && !(p.type === 'dev_fee' && p.stage === 'final')).length
    if (otpWaiting) todos.push({ label: `입금확인 ${otpWaiting}`, color: '#f59e0b' })
    const unpaid = billingsOf(site).filter(bh => bh.status !== 'paid').length
    if (unpaid) todos.push({ label: `미납 ${unpaid}`, color: '#ef4444' })
    const open = ticketsOf(site).filter(t => t.status !== 'resolved').length
    if (open) todos.push({ label: `요청 ${open}`, color: '#60a5fa' })
    return todos
  }
  const todoSites = sites.map(site => ({ site, todos: siteTodos(site) })).filter(x => x.todos.length)

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

      {/* 사이트 개설 모달 — 제작문의·사이트 리스트 공통 */}
      {showCreateForm && (
        <div
          onClick={closeCreateModal}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 80,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 520, background: '#0f172a', border: '1px solid #334155',
              borderRadius: 12, padding: '22px 22px 18px', maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#f1f5f9', fontWeight: 800 }}>
              사이트 개설
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#64748b' }}>
              가입 회원을 선택하세요. 직접제작만 개설됩니다. (대리제작은 고객이 의뢰하면 사이트가 함께 생깁니다)
            </p>
            <form onSubmit={createSite}>
              <div style={{ marginBottom: 14 }}>
                <label style={css.label}>회원 *</label>
                  <select
                    value={form.customer_id}
                    onChange={e => {
                      const id = e.target.value
                      const c = customers.find(x => x.customer_id === id)
                      setForm(f => ({
                        ...f,
                        customer_id: id,
                        customer_name: c?.name || '',
                        customer_email: c?.email || '',
                        customer_phone: c?.phone || '',
                        phone: f.phone || c?.phone || '',
                        email: f.email || c?.email || '',
                      }))
                    }}
                    style={{ ...css.input, cursor: 'pointer' }}
                    required
                  >
                    <option value="">가입 회원 선택</option>
                    {customers.map(c => (
                      <option key={c.customer_id} value={c.customer_id}>
                        {c.name} ({c.email})
                      </option>
                    ))}
                  </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ marginBottom: 14 }}>
                <div>
                  <label style={css.label}>사이트명 *</label>
                  <input
                    value={form.site_name}
                    onChange={e => setForm({ ...form, site_name: e.target.value })}
                    placeholder="마곡카페"
                    required
                    style={css.input}
                  />
                </div>
                <div>
                  <label style={css.label}>서브도메인 *</label>
                  <input
                    value={form.subdomain}
                    onChange={e => setForm({ ...form, subdomain: e.target.value.toLowerCase() })}
                    placeholder="magokcafe"
                    required
                    style={css.input}
                  />
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    {form.subdomain || '…'}.myplatform.com · 영문 소문자·숫자·하이픈 3~30자
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={css.label}>템플릿</label>
                <select
                  value={form.template_id}
                  onChange={e => setForm({ ...form, template_id: e.target.value })}
                  style={{ ...css.input, cursor: 'pointer' }}
                >
                  <option value="">선택 안 함</option>
                  {templates.map(t => (
                    <option key={t.template_id} value={t.template_id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {message && showCreateForm && (
                <div style={{
                  marginBottom: 12, fontSize: 12,
                  color: message.startsWith('✅') ? '#22c55e' : '#f87171',
                }}>
                  {message}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeCreateModal} style={{
                  padding: '9px 16px', background: 'transparent', color: '#94a3b8',
                  border: '1px solid #334155', borderRadius: 7, cursor: 'pointer', fontSize: 13,
                }}>
                  취소
                </button>
                <button type="submit" disabled={loading} style={{
                  padding: '9px 18px', background: '#2563eb', color: 'white',
                  border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13,
                  fontWeight: 700, opacity: loading ? 0.6 : 1,
                }}>
                  {loading ? '개설 중…' : '개설하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            if (item.key === 'sites') badgeCount = todoSites.length
            if (item.key === 'tickets') badgeCount = tickets.filter(t => t.status !== 'resolved' || ticketsNeedReply(t)).length
            return (
              <button
                key={item.key}
                data-testid={`platform-nav-${item.key}`}
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

        <div style={{ padding: '12px 14px', borderTop: '1px solid #1e293b' }}>
          <div style={{ fontSize: 11, color: '#475569', marginBottom: 10, padding: '0 4px' }}>
            회원 {customers.length} · 사이트 {sites.length} · 구독 {activeSubCount}
          </div>
          <div style={{
            marginBottom: 4, padding: '8px 10px', borderRadius: 8,
            background: '#0f172a', border: '1px solid #1e293b',
          }}>
            <AuthUserBar
              variant="dark"
              preset={staff
                ? { status: 'ok', kind: 'staff', name: staff.name || '본사', email: staff.email || '' }
                : { status: 'loading', kind: null, name: '', email: '' }}
            />
          </div>
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
              onClick={() => setNav('dashboard')}
              style={{
                marginLeft: 12, padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: '#f59e0b22', color: '#f59e0b', fontSize: 12, fontWeight: 700,
              }}
            >
              입금확인 대기 {pendingConfirmOtp.length}건
            </button>
          )}
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
                { label: '처리 필요', value: todoSites.length, color: todoSites.length > 0 ? '#f59e0b' : '#22c55e' },
              ].map(({ label, value, color }) => (
                <div key={label} style={css.statCard}>
                  <div style={{ fontSize: 11, color: '#475569', marginBottom: 8, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ ...css.card, border: todoSites.length ? '1px solid #f59e0b55' : undefined }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>
                처리 필요 — 사이트 {todoSites.length}곳
              </h3>
              {todoSites.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>지금 처리할 항목이 없습니다.</p>
              )}
              {todoSites.map(({ site, todos }) => (
                <button key={site.site_id} type="button" onClick={() => openSiteDetail(site.site_id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                    padding: '12px 14px', marginBottom: 8, background: '#0f172a', textAlign: 'left',
                    border: '1px solid #1e293b', borderRadius: 8, cursor: 'pointer',
                  }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{site.name}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{site.customers?.name}</span>
                  {badge(codeColor('FLOW_STEP', site.status), codeLabel('FLOW_STEP', site.status, flowStepLabel(site.status)))}
                  <span style={{ flex: 1 }} />
                  {todos.map(t => <span key={t.label}>{badge(t.color, t.label)}</span>)}
                  <span style={{ fontSize: 12, color: '#64748b' }}>›</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── 회원 (customers) ── */}
        {nav === 'customers' && (() => {
          const filteredCustomers = customers.filter(c =>
            matchesSearchQuery(
              customerSearchQuery,
              c.name,
              c.email,
              c.phone,
              codeLabel('CUSTOMER_STATUS', c.status, c.status),
            )
          )
          const selectedCustomer = filteredCustomers.find(c => c.customer_id === selectedCustomerId)
            || customers.find(c => c.customer_id === selectedCustomerId)
            || null
          return (
            <>
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>
                  회원 목록 ({filteredCustomers.length}{customerSearchQuery ? ` / ${customers.length}` : ''}명)
                  <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 500, color: '#64748b' }}>
                    행 클릭 → 상세 · 보유 사이트
                  </span>
                </h3>
              </div>
              <PlatformListSearch
                value={customerSearchInput}
                onChange={setCustomerSearchInput}
                onSearch={() => runSearch(() => setCustomerSearchQuery(customerSearchInput.trim()))}
                onReset={() => { setCustomerSearchInput(''); setCustomerSearchQuery('') }}
                placeholder="이름, 이메일, 연락처, 상태"
                applied={!!customerSearchQuery}
                appliedQuery={customerSearchQuery}
                resultLabel={`${filteredCustomers.length}명`}
                busy={searching}
                loadedAt={loadedAt}
              />
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
                        {filteredCustomers.map(c => {
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
                        {filteredCustomers.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ ...css.td, textAlign: 'center', color: '#475569' }}>
                              {customerSearchQuery ? '검색 결과가 없습니다' : '회원이 없습니다'}
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
          const filterDef = SITE_FILTERS.find(f => f.key === siteFilter) || SITE_FILTERS[0]
          const inFilter = (site, f) => f.key === 'todo' ? siteTodos(site).length > 0 : f.match(site)
          const filteredSites = sites.filter(site => inFilter(site, filterDef)).filter(site =>
            matchesSearchQuery(
              siteSearchQuery,
              site.name,
              site.subdomain,
              site.site_code,
              site.customers?.name,
              site.customers?.email,
            )
          )
          const selectedSite = filteredSites.find(s => s.site_id === selectedSiteId)
            || sites.find(s => s.site_id === selectedSiteId)
            || null
          const selectedInquiry = inquiryOf(selectedSite)
          const selectedSub = selectedSite ? subOf(selectedSite) : null

          return (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>
                  사이트 목록 ({filteredSites.length}{siteSearchQuery ? ` / ${sites.length}` : ''}개)
                  <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 500, color: '#64748b' }}>
                    행을 클릭하면 흐름·돈 상태를 봅니다
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={openCreateModalBlank}
                  style={{
                    padding: '8px 14px', background: '#2563eb',
                    color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer',
                    fontSize: 13, fontWeight: 700,
                  }}
                >
                  + 새 사이트
                </button>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {SITE_FILTERS.map(f => {
                  const n = sites.filter(site => inFilter(site, f)).length
                  const on = siteFilter === f.key
                  return (
                    <button key={f.key} type="button" onClick={() => setSiteFilter(f.key)}
                      style={{
                        padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        border: `1px solid ${on ? '#3b82f6' : '#334155'}`,
                        background: on ? '#1e3a8a' : 'transparent',
                        color: on ? '#dbeafe' : (f.key === 'todo' && n ? '#fbbf24' : '#94a3b8'),
                      }}>
                      {f.label} {n}
                    </button>
                  )
                })}
              </div>

              <PlatformListSearch
                value={siteSearchInput}
                onChange={setSiteSearchInput}
                onSearch={() => runSearch(() => setSiteSearchQuery(siteSearchInput.trim()))}
                onReset={() => { setSiteSearchInput(''); setSiteSearchQuery('') }}
                placeholder="사이트명, 주소명, 고객명, 이메일"
                applied={!!siteSearchQuery}
                appliedQuery={siteSearchQuery}
                resultLabel={`${filteredSites.length}건`}
                busy={searching}
                loadedAt={loadedAt}
              />

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
                        <tr>{['사이트명', '고객', '유형', '상태', '기간', '결제', '처리 필요', ''].map((h, i) =>
                          <th key={h || `a${i}`} style={{ ...css.th, whiteSpace: 'nowrap' }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSites.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ ...css.td, color: '#64748b', textAlign: 'center', padding: '28px 12px' }}>
                              {siteSearchQuery || siteFilter !== 'all' ? '조건에 맞는 사이트가 없습니다' : '사이트가 없습니다'}
                            </td>
                          </tr>
                        ) : filteredSites.map(site => {
                          const sub = subOf(site)
                          const todos = siteTodos(site)
                          const period = getSitePeriodInfo(site)
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
                              data-testid={`platform-site-${site.subdomain}`}
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
                              <td style={css.td}>
                                {badge(codeColor('FLOW_STEP', site.status), codeLabel('FLOW_STEP', site.status, flowStepLabel(site.status)))}
                              </td>
                              <td style={css.td}>{periodBadge}</td>
                              <td style={css.td}>
                                {sub ? (
                                  <>
                                    {badge(codeColor('PAYMENT_METHOD', sub.payment_method), codeLabel('PAYMENT_METHOD', sub.payment_method))}
                                    <div style={{ marginTop: 4, fontSize: 10, color: '#94a3b8' }}>
                                      {sub.cancels_at ? `종료 ${new Date(sub.cancels_at).toLocaleDateString('ko-KR')}` : (sub.next_billing_date ? `청구 ${sub.next_billing_date}` : '—')}
                                    </div>
                                  </>
                                ) : <span style={{ fontSize: 12, color: '#475569' }}>—</span>}
                              </td>
                              <td style={css.td}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {todos.map(t => <span key={t.label}>{badge(t.color, t.label)}</span>)}
                                </div>
                              </td>
                              <td style={{ ...css.td, width: 72 }} onClick={e => e.stopPropagation()}>
                                {(() => {
                                  const inq = inquiryOf(site)
                                  const step = site.build_type === 'managed'
                                    ? resolveManagedFlowStep(inq, {
                                      site,
                                      finalPending: hasPendingDeposit(site.customer_id) && !inq?.final_paid_at,
                                    })
                                    : resolveSelfFlowStep(site)
                                  if (!site.subdomain || !canOpenHqEditor(site.build_type, step)) return null
                                  return (
                                    <button
                                      type="button"
                                      title="에디터 열기"
                                      onClick={() => window.open(siteAdminPath(site.subdomain, '/editor'), '_blank')}
                                      style={{
                                        padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                        background: '#0f172a', color: '#93c5fd',
                                        border: '1px solid #334155', borderRadius: 6,
                                      }}
                                    >
                                      에디터
                                    </button>
                                  )
                                })()}
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
                    oneTimePays={otpsOf(selectedSite)}
                    billingHistory={billingsOf(selectedSite)}
                    tickets={ticketsOf(selectedSite)}
                    finalPending={
                      hasPendingDeposit(selectedSite.customer_id) && !selectedInquiry?.final_paid_at
                    }
                    onClose={() => setSelectedSiteId(null)}
                    onStatusAction={updateSiteStatus}
                    onConfirmFinal={confirmFinalPayment}
                    onStartDeposit={startDepositStep}
                    onConfirmDeposit={confirmDownPayment}
                    onCancelManaged={
                      selectedInquiry ? () => handleCancelManagedIntake(selectedInquiry.inquiry_id) : undefined
                    }
                    onSaveDevFee={saveDevFee}
                    onSaveNote={saveAdminNote}
                    onMarkOtpPaid={markOneTimePaid}
                    onMarkBillingPaid={markBillingPaid}
                    onTicketUpdate={updateTicket}
                    onTicketAddMessage={addTicketMsg}
                    onTicketRead={readTicketMsgs}
                    ticketMessages={ticketMsgs}
                    ticketQuotes={ticketQuotes}
                    onSendQuote={sendTicketQuote}
                    onCancelQuote={cancelTicketQuote}
                    staff={staff}
                    onGoCustomer={openCustomerDetail}
                    onSave={saveSiteFields}
                    onDelete={deleteSite}
                  />
                )}
              </div>
            </>
          )
        })()}

        {/* ── 고객 요청 (사장님 → 본사) — 읽고·고치고·답변하고 완료 ── */}
        {nav === 'tickets' && (() => {
          const searched = tickets.filter(t =>
            matchesSearchQuery(
              ticketSearchQuery,
              t.sites?.name,
              t.customers?.name,
              t.title,
              t.content,
              codeLabel('TICKET_CATEGORY', t.category, t.category),
              codeLabel('TICKET_PRIORITY', t.priority, t.priority),
              codeLabel('TICKET_STATUS', t.status, t.status),
            )
          )
          const pendingCount = searched.filter(t => t.status !== 'resolved').length
          const list = (ticketOnlyOpen ? searched.filter(t => t.status !== 'resolved') : searched)
            .slice()
            .sort((x, y) => {
              const done = (t) => t.status === 'resolved' ? 1 : 0
              if (done(x) !== done(y)) return done(x) - done(y)
              return new Date(x.deadline_at || x.created_at) - new Date(y.deadline_at || y.created_at)
            })
          const siteOf = (t) => sites.find(st => st.site_id === t.site_id)

          return (
            <div style={css.card}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>
                고객 요청 — {pendingCount}건 미처리
                <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 500, color: '#64748b' }}>
                  기한 임박 순 · 펼쳐서 내용 확인 → 에디터 수정 → 답변 보내고 완료
                </span>
              </h3>
              <PlatformListSearch
                value={ticketSearchInput}
                onChange={setTicketSearchInput}
                onSearch={() => runSearch(() => setTicketSearchQuery(ticketSearchInput.trim()))}
                onReset={() => { setTicketSearchInput(''); setTicketSearchQuery('') }}
                placeholder="사이트, 고객, 제목, 내용, 유형, 상태"
                applied={!!ticketSearchQuery}
                appliedQuery={ticketSearchQuery}
                resultLabel={`${searched.length}건`}
                busy={searching}
                loadedAt={loadedAt}
              />
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>
                <input type="checkbox" checked={ticketOnlyOpen} onChange={e => setTicketOnlyOpen(e.target.checked)} />
                미처리만 보기
              </label>

              {list.length === 0 ? (
                <p style={{ margin: 0, padding: '24px 0', textAlign: 'center', fontSize: 13, color: '#475569' }}>
                  {ticketSearchQuery ? '검색 결과가 없습니다' : ticketOnlyOpen ? '미처리 요청이 없습니다' : '요청이 없습니다'}
                </p>
              ) : list.map(t => (
                <PlatformTicketCard
                  key={t.ticket_id}
                  ticket={t}
                  messages={ticketMsgs[t.ticket_id] || []}
                  quote={ticketQuotes[t.ticket_id] || null}
                  staff={staff}
                  subdomain={siteOf(t)?.subdomain}
                  onUpdate={updateTicket}
                  onAddMessage={addTicketMsg}
                  onRead={readTicketMsgs}
                  onSendQuote={sendTicketQuote}
                  onCancelQuote={cancelTicketQuote}
                  onMarkQuotePaid={markOneTimePaid}
                />
              ))}
            </div>
          )
        })()}

        {/* ── 개발: 테스트 · 공통코드 · 개발 문서 ── */}
        {nav === 'dev' && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {DEV_TABS.map(t => (
                <button key={t.key} type="button" onClick={() => setDevTab(t.key)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${devTab === t.key ? '#3b82f6' : '#334155'}`,
                    background: devTab === t.key ? '#1e3a8a' : 'transparent',
                    color: devTab === t.key ? '#dbeafe' : '#94a3b8',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
            {devTab === 'test' && (
              <PlatformDevTools
                sites={sites}
                inquiries={inquiries}
                subscriptions={subscriptions}
                oneTimePays={oneTimePays}
                onRefresh={fetchAll}
              />
            )}
            {devTab === 'codes' && (
              <div style={css.card}>
                <PlatformCommonCodes />
              </div>
            )}
            {devTab === 'docs' && (
              <div style={css.card}>
                <h3 style={{ margin: '0 0 16px', fontSize: 14, color: '#f1f5f9', fontWeight: 700 }}>
                  개발 문서 — 플로우 · ERD · 테이블명세 · 작업이력
                </h3>
                <DocsBrowser />
              </div>
            )}
          </>
        )}

      </div>
      </div>
    </div>
  )
}
