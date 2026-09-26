'use client'
import { useState, useEffect } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { requireAuthUser } from '@/lib/auth'
import { onlyActive } from '@/lib/use-flag'
import { paymentMethodUrl, getBankAccountText } from '@/lib/billing'
import {
  deploySiteAction,
  cancelSubscriptionAction,
  reinstateSubscriptionAction,
  saveSiteOwnerPatchAction,
  createSupportTicketAction,
  updateSupportTicketAction,
  cancelSupportTicketAction,
  addCustomerTicketMessageAction,
  markCustomerTicketsReadAction,
  rejectQuoteAction,
} from '@/app/s/[siteCode]/admin/actions'
import { withdrawCustomerAction } from '@/app/my/actions'
import { getSubscriptionUiFlags } from '@/lib/subscription-life'
import {
  canStartManagedService,
  managedBlockedMessage,
  managedNeedsGoLive,
} from '@/lib/managed-flow'
import {
  paymentCardPath,
  sitePublicPath,
  sitePublicHostname,
} from '@/lib/site-paths'
import { loadCommonCodes, codeLabel, codeColor } from '@/lib/common-codes'
import { customerNextLine } from '@/lib/flow-step'
import {
  loadCustomerTicketMessages, canCustomerEditTicket, unreadFrom,
} from '@/lib/support-ticket'
import SiteAdminShell, { parentKeyOf } from '@/components/SiteAdminShell'
import DeployDoneModal from '@/components/DeployDoneModal'
import UserPostsManager from '@/components/UserPostsManager'
import UserBoardsManager from '@/components/UserBoardsManager'
import { loadBoards, loadPostsWithComments, unansweredPosts } from '@/lib/user-board'
import { loadTicketQuotes, quoteLabel } from '@/lib/payment/extra'
import { siteTemplateCategory, templateCategoryLabel } from '@/lib/template-category'

const CATEGORIES = [
  { value: 'text_change', icon: '✏️' },
  { value: 'image',       icon: '🖼️' },
  { value: 'page_add',    icon: '📄' },
  { value: 'feature',     icon: '⚙️' },
  { value: 'etc',         icon: '💬' },
]

export default function CustomerPortal({ params }) {
  const { siteCode } = use(params)
  const router = useRouter()
  const [menuKey, setMenuKey] = useState('dashboard')
  const [openGroups, setOpenGroups] = useState({ content: true, billing: true, settings: true, support: true })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [site, setSite] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [tickets, setTickets] = useState([])
  const [boards, setBoards] = useState([])
  const [posts, setPosts] = useState([])
  const [focusPostId, setFocusPostId] = useState(null)
  const [alertsShown, setAlertsShown] = useState(null)   // 알림 화면 진입 시점 목록 (읽음 처리돼도 유지)
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [ticketMsgs, setTicketMsgs] = useState({})     // { ticket_id: [메시지] } — 내부 메모 제외
  const [ticketQuotes, setTicketQuotes] = useState({}) // { ticket_id: 유료 작업 견적 }
  const [ticketReply, setTicketReply] = useState({})   // { ticket_id: 입력중 }
  const [editTicketId, setEditTicketId] = useState(null)
  const [editTicketForm, setEditTicketForm] = useState({ title: '', content: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [showDeployModal, setShowDeployModal] = useState(false)
  const [deployed, setDeployed] = useState(null)   // { trialEndsAt, card, subscription }
  const [subscription, setSubscription] = useState(null)
  const [inquiry, setInquiry] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [billingHistory, setBillingHistory] = useState([])
  const [saveMsg, setSaveMsg] = useState('')
  const [ticketMsg, setTicketMsg] = useState('')
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawInput, setWithdrawInput] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  const [siteForm, setSiteForm] = useState({ name: '', description: '', address: '', phone: '', email: '' })
  const [ticketForm, setTicketForm] = useState({ title: '', content: '', category: 'etc' })

  useEffect(() => { checkAuthAndFetch() }, [siteCode])

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get('menu')
    if (m) selectMenu(m)
  }, [])

  // 알림 · 본사 요청 화면을 열면 본사 메시지 읽음 처리 → 알림·뱃지에서 빠짐
  useEffect(() => {
    if (!['support.requests', 'alerts'].includes(menuKey) || !tickets.length || !site) return
    const ids = tickets.filter(t => unreadFrom(ticketMsgs[t.ticket_id], 'staff').length).map(t => t.ticket_id)
    if (!ids.length) return
    markCustomerTicketsReadAction(siteCode, ids).then(res => {
      if (res.ok && res.data?.changed) fetchTickets(site.site_id)
    })
  }, [menuKey, tickets, ticketMsgs, site])

  async function checkAuthAndFetch() {
    const user = await requireAuthUser()
    if (!user) { router.push('/login'); return }

    try { await loadCommonCodes() } catch (_) { /* 라벨 fallback = code */ }

    const { data: cust } = await onlyActive(
      supabase.from('customers').select('*').eq('auth_id', user.id)
    ).single()
    if (!cust) { router.push('/login'); return }
    if (cust.status === 'withdrawn') {
      router.push('/my')  // /my 에서 재활성화 UI 처리
      return
    }
    setCustomer(cust)

    const { data: siteData } = await onlyActive(
      supabase.from('sites').select('*, templates(name, category)')
        .eq('subdomain', siteCode)
        .eq('customer_id', cust.customer_id)
    ).single()
    if (!siteData) { router.push('/my'); return }

    setSite(siteData)
    setSiteForm({
      name: siteData.name || '', description: siteData.description || '',
      address: siteData.address || '', phone: siteData.phone || '', email: siteData.email || '',
    })
    if (siteData.inquiry_id) {
      const { data: inq } = await onlyActive(
        supabase.from('inquiries').select('*').eq('inquiry_id', siteData.inquiry_id)
      ).maybeSingle()
      setInquiry(inq)
    } else {
      setInquiry(null)
    }
    fetchTickets(siteData.site_id)
    fetchBoardData(siteData.site_id)

    const { data: sub } = await onlyActive(
      supabase.from('subscriptions').select('*').eq('site_id', siteData.site_id)
    ).maybeSingle()
    setSubscription(sub)

    const { data: pm } = await onlyActive(
      supabase.from('customer_payment_methods').select('*')
        .eq('customer_id', cust.customer_id)
    ).maybeSingle()
    setPaymentMethod(pm)

    if (sub) {
      const { data: bh } = await onlyActive(
        supabase.from('billing_history').select('*')
          .eq('subscription_id', sub.subscription_id)
          .order('period', { ascending: false })
      )
      setBillingHistory(bh || [])
    }

    setLoading(false)
  }

  async function fetchTickets(siteId) {
    const { data } = await onlyActive(
      supabase.from('support_tickets').select('*')
        .eq('site_id', siteId).order('created_at', { ascending: false })
    )
    setTickets(data || [])
    const ids = (data || []).map(t => t.ticket_id)
    setTicketMsgs(await loadCustomerTicketMessages(supabase, ids))
    setTicketQuotes(await loadTicketQuotes(supabase, ids))
  }

  /** 사장님 → 본사 추가 메시지 */
  async function sendTicketMessage(ticketId) {
    const content = ticketReply[ticketId] || ''
    if (!content.trim()) return
    const res = await addCustomerTicketMessageAction(siteCode, ticketId, content)
    if (!res.ok) { setTicketMsg('❌ ' + res.error); return }
    setTicketReply(prev => ({ ...prev, [ticketId]: '' }))
    await fetchTickets(site.site_id)
  }

  /** 견적 거절 — 결제 전만 */
  async function rejectQuote(ticketId, paymentId) {
    if (!window.confirm('이 견적을 거절할까요?\n본사에 거절 의사가 전달됩니다.')) return
    const res = await rejectQuoteAction(siteCode, ticketId, paymentId)
    if (!res.ok) { setTicketMsg('❌ ' + res.error); return }
    await fetchTickets(site.site_id)
  }

  /** 접수 상태에서만 수정 */
  async function saveTicketEdit(ticketId) {
    if (!editTicketForm.title.trim() || !editTicketForm.content.trim()) return
    const res = await updateSupportTicketAction(siteCode, ticketId, {
      title: editTicketForm.title,
      content: editTicketForm.content,
    })
    if (!res.ok) { setTicketMsg('❌ ' + res.error); return }
    setEditTicketId(null)
    await fetchTickets(site.site_id)
  }

  /** 접수 상태에서만 취소 (soft delete) */
  async function cancelTicket(ticketId) {
    if (!window.confirm('이 요청을 취소할까요?\n본사가 처리를 시작하기 전에만 취소할 수 있습니다.')) return
    const res = await cancelSupportTicketAction(siteCode, ticketId)
    if (!res.ok) { setTicketMsg('❌ ' + res.error); return }
    await fetchTickets(site.site_id)
  }

  async function fetchBoardData(siteId) {
    const [b, p] = await Promise.all([loadBoards(supabase, siteId), loadPostsWithComments(supabase, siteId)])
    setBoards(b)
    setPosts(p)
  }

  async function saveSiteInfo(e) {
    e.preventDefault(); setSaving(true); setSaveMsg('')
    const res = await saveSiteOwnerPatchAction(siteCode, siteForm)
    setSaveMsg(res.ok ? '✅ 저장되었습니다!' : '❌ ' + res.error)
    setSaving(false)
  }

  async function submitTicket(e) {
    e.preventDefault(); setTicketMsg('')
    const res = await createSupportTicketAction(siteCode, ticketForm)
    if (!res.ok) { setTicketMsg('❌ 접수 실패: ' + res.error) }
    else {
      setTicketMsg('✅ 접수되었습니다! 3영업일 이내 처리해드릴게요.')
      setTicketForm({ title: '', content: '', category: 'etc' })
      setShowTicketForm(false)
      fetchTickets(site.site_id)
      setTimeout(() => setTicketMsg(''), 3000)
    }
  }

  async function handleDeploy() {
    if (site.build_type === 'managed' && !canStartManagedService(inquiry, site)) {
      alert(managedBlockedMessage(inquiry, site))
      return
    }

    setDeploying(true)
    const res = await deploySiteAction(siteCode)
    if (!res.ok) {
      alert(res.error)
      setDeploying(false)
      return
    }

    const { requireBillingSetup, trialEndsAt, card, subscription: newSub } = res.data
    if (requireBillingSetup) {
      router.push(paymentMethodUrl(siteCode, 'deploy'))
    } else {
      setSite(prev => ({
        ...prev,
        status: 'trial',
        trial_ends_at: trialEndsAt,
      }))
      setSubscription(newSub)
      setDeployed({ trialEndsAt, card, subscription: newSub })
      setShowDeployModal(true)
    }
    setDeploying(false)
  }

  async function handleCancelSubscription() {
    if (!subscription) return
    if (!window.confirm('구독을 해지하시겠습니까?\n남은 기간까지는 계속 이용하실 수 있습니다.')) return
    const res = await cancelSubscriptionAction(siteCode)
    if (!res.ok) { alert(res.error); return }
    setSubscription(res.data)
  }

  async function handleReinstate() {
    const res = await reinstateSubscriptionAction(siteCode)
    if (!res.ok) { alert(res.error); return }
    setSubscription(res.data)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleWithdraw() {
    if (withdrawInput !== '탈퇴') return
    setWithdrawing(true)

    const res = await withdrawCustomerAction(siteCode)
    if (!res.ok) {
      alert(res.error)
      setWithdrawing(false)
      return
    }
    await supabase.auth.signOut()
    if (res.data?.pending) {
      router.push('/login?error=withdraw_pending&until=' + res.data.until)
    } else {
      router.push('/login?error=withdrawn')
    }
  }

  function selectMenu(key, postId = null) {
    // 알림 화면: 들어간 순간의 목록을 고정 (읽음 처리로 눈앞에서 사라지지 않게)
    setAlertsShown(key === 'alerts' ? alerts : null)
    setMenuKey(key)
    setFocusPostId(postId)
    const parent = parentKeyOf(key)
    setOpenGroups(prev => ({ ...prev, [parent]: true }))
  }

  function toggleGroup(groupKey) {
    setOpenGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))
  }

  const DAY = 24 * 60 * 60 * 1000
  const waitingPosts = unansweredPosts(posts, boards)
  const boardName = (id) => boards.find(b => b.user_board_id === id)?.name || '게시판'
  /** 안 읽은 본사 메시지 — 본사 요청 화면을 열면 읽음 처리되어 사라짐 */
  const recentStaffMsgs = tickets.flatMap(t =>
    unreadFrom(ticketMsgs[t.ticket_id], 'staff').map(m => ({ ticket: t, msg: m })))
  const openTickets = tickets.filter(t => t.status !== 'resolved')
  const trialDaysLeft = site?.status === 'trial' && site?.trial_ends_at
    ? Math.ceil((new Date(site.trial_ends_at) - Date.now()) / DAY)
    : null
  const unpaidBills = billingHistory.filter(bh => bh.status === 'unpaid' || bh.status === 'overdue')

  /** 알림 = 지금 처리할 일 (DB 없이 계산 · 처리하면 사라짐) */
  const alerts = [
    ...waitingPosts.map(p => ({
      id: 'post-' + p.post_id, icon: '💬', menu: 'content.posts', postId: p.post_id,
      text: `[${boardName(p.user_board_id)}] ${p.author} — 답변 대기`,
      sub: (p.is_private ? '🔒 ' : '') + p.title, at: p.created_at,
    })),
    ...recentStaffMsgs.map(({ ticket, msg }) => ({
      id: 'tkm-' + msg.ticket_message_id, icon: '💌', menu: 'support.requests',
      text: `본사 답변 — ${ticket.title}`,
      sub: msg.content, at: msg.created_at,
    })),
    ...(trialDaysLeft !== null && trialDaysLeft <= 3 ? [{
      id: 'trial', icon: '⏳', menu: 'billing.sub',
      text: trialDaysLeft <= 0
        ? `무료 체험이 오늘 종료됩니다 — 결제 수단을 확인해 주세요`
        : `무료 체험 종료 D-${trialDaysLeft} — 결제 수단을 확인해 주세요`,
      at: site.trial_ends_at,
    }] : []),
    ...unpaidBills.map(bh => ({
      id: 'bill-' + bh.billing_id, icon: '💳', menu: 'billing.history',
      text: `${bh.period} 이용료 미납`, sub: `${bh.amount.toLocaleString()}원`, at: bh.due_at || bh.created_at,
    })),
  ]

  const badges = { unanswered: waitingPosts.length, staffReplies: recentStaffMsgs.length }

  const css = {
    page: { minHeight: '100vh', background: '#f8f7f4', fontFamily: "'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif" },
    card: { background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', padding: 28, marginBottom: 20 },
    input: { width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none', color: '#111827', background: 'white', boxSizing: 'border-box' },
    label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 },
    btn: { padding: '10px 24px', background: '#111827', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  }

  const badge = (color, text) => (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: color + '18', color, display: 'inline-block' }}>{text}</span>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8f7f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#9ca3af', fontSize: 14 }}>로딩 중...</div>
    </div>
  )

  const deployPanel = (() => {
    // 서비스/배포 이미 시작됨 → 운영 중 (inquiry가 done이 되어도 검수 안내로 가면 안 됨)
    const alreadyLive = !!(site.trial_started_at || ['trial', 'subscribed'].includes(site.status))
    if (alreadyLive) {
      return (
        <div style={{ ...css.card, border: '1px solid #d1fae5', background: '#f0fdf4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#065f46' }}>✅ 사이트 운영 중</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>사이트가 정상적으로 배포되어 있어요</p>
            </div>
            <button onClick={() => router.push(paymentMethodUrl(siteCode))}
              style={{ padding: '8px 16px', background: '#111827', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 16 }}>
              결제 수단 변경
            </button>
          </div>
        </div>
      )
    }

    // managed: 잔금·승인 전 → 안내만
    if (site.build_type === 'managed' && !canStartManagedService(inquiry, site)) {
      return (
        <div style={{ ...css.card, border: '1px solid #e9d5ff', background: '#faf5ff' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#6b21a8' }}>검수·잔금 단계</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#7c3aed' }}>
            {managedBlockedMessage(inquiry, site) || '본사 검수가 진행 중입니다.'}
          </p>
        </div>
      )
    }

    const needsGoLive = site.build_type === 'managed'
      ? managedNeedsGoLive(site, inquiry)
      : true

    if (!needsGoLive) {
      return (
        <div style={{ ...css.card, border: '1px solid #d1fae5', background: '#f0fdf4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#065f46' }}>✅ 사이트 운영 중</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>사이트가 정상적으로 배포되어 있어요</p>
            </div>
            <button onClick={() => router.push(paymentMethodUrl(siteCode))}
              style={{ padding: '8px 16px', background: '#111827', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 16 }}>
              결제 수단 변경
            </button>
          </div>
        </div>
      )
    }

    const title = site.build_type === 'managed' ? '🚀 서비스 시작하기' : '🚀 사이트 배포하기'
    const desc = site.build_type === 'managed'
      ? '결제 수단 등록 후 무료 체험을 시작해요'
      : '배포하면 누구나 사이트를 볼 수 있어요'
    return (
      <div style={{ ...css.card, background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'white' }}>{title}</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#99f6e4' }}>{desc}</p>
          </div>
          <button data-testid="admin-deploy" onClick={handleDeploy} disabled={deploying}
            style={{ padding: '10px 22px', background: 'white', color: '#0f766e', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: deploying ? 'default' : 'pointer', opacity: deploying ? 0.7 : 1, whiteSpace: 'nowrap', marginLeft: 20 }}>
            {deploying ? '처리 중...' : site.build_type === 'managed' ? '시작하기' : '배포하기'}
          </button>
        </div>
      </div>
    )
  })()

  return (
    <>
      {/* 회원탈퇴 확인 모달 */}
      {showWithdrawModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: '36px 32px', maxWidth: 400, width: '90%' }}>
            <div style={{ fontSize: 36, marginBottom: 12, textAlign: 'center' }}>⚠️</div>
            <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800, color: '#111827', textAlign: 'center' }}>정말 탈퇴하시겠습니까?</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280', lineHeight: 1.7, textAlign: 'center' }}>
              모든 사이트가 즉시 비활성화됩니다.<br />
              데이터는 보관되며 재가입은 현재 지원되지 않습니다.
            </p>
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#991b1b' }}>
              아래 입력란에 <b>탈퇴</b>를 입력하면 탈퇴가 진행됩니다.
            </div>
            <input
              value={withdrawInput}
              onChange={e => setWithdrawInput(e.target.value)}
              placeholder="탈퇴"
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowWithdrawModal(false); setWithdrawInput('') }}
                style={{ flex: 1, padding: '11px 0', background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
                취소
              </button>
              <button onClick={handleWithdraw} disabled={withdrawInput !== '탈퇴' || withdrawing}
                style={{ flex: 1, padding: '11px 0', background: withdrawInput === '탈퇴' ? '#ef4444' : '#f3f4f6', color: withdrawInput === '탈퇴' ? 'white' : '#9ca3af', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: withdrawInput === '탈퇴' ? 'pointer' : 'default' }}>
                {withdrawing ? '처리 중...' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 배포 완료 — 등록된 결제 수단 그대로 안내 */}
      {showDeployModal && (
        <DeployDoneModal
          siteCode={siteCode}
          trialEndsAt={deployed?.trialEndsAt}
          card={deployed?.card}
          subscription={deployed?.subscription || subscription}
          onClose={() => setShowDeployModal(false)}
          onGoPayment={(href) => { setShowDeployModal(false); router.push(href) }}
        />
      )}

      <SiteAdminShell
        site={site}
        siteCode={siteCode}
        customer={customer}
        menuKey={menuKey}
        onMenuChange={selectMenu}
        openGroups={openGroups}
        onToggleGroup={toggleGroup}
        badges={badges}
        alertCount={alerts.length}
        mobileOpen={mobileOpen}
        onMobileOpen={setMobileOpen}
        onLogout={handleLogout}
      >
        {menuKey === 'dashboard' && (() => {
          // 상태·결제·다음 할 일을 카드 하나로 (같은 말 반복 금지)
          const live = ['trial', 'subscribed'].includes(site.status)
          const endText = site.trial_ends_at ? new Date(site.trial_ends_at).toLocaleDateString('ko-KR') : null
          const nextText = subscription?.next_billing_date
            ? new Date(subscription.next_billing_date).toLocaleDateString('ko-KR')
            : null
          const payMethod = paymentMethod ? 'card' : subscription?.payment_method === 'manual' ? 'manual' : null

          let payLine = null
          if (live && payMethod === 'card') {
            payLine = `${endText && site.status === 'trial' ? `${endText} 체험 종료 → ` : nextText ? `${nextText} → ` : ''}${paymentMethod.card_name || '카드'} •••• ${paymentMethod.card_last4} 로 월 ${(subscription?.amount || 30000).toLocaleString()}원 자동 결제`
          } else if (live && payMethod === 'manual') {
            payLine = `${endText && site.status === 'trial' ? `${endText} 체험 종료 후 ` : nextText ? `${nextText}까지 ` : ''}안내 계좌로 월 ${(subscription?.amount || 30000).toLocaleString()}원 입금 · 입금자명 ${subscription?.depositor_name || '—'}`
          }

          const tiles = [
            { label: '답변 대기 글', value: `${waitingPosts.length}건`, menu: 'content.posts', hot: waitingPosts.length > 0 },
            { label: '진행 중 본사 요청', value: `${openTickets.length}건`, menu: 'support.requests' },
            unpaidBills.length > 0
              ? { label: '미납', value: `${unpaidBills.length}건`, menu: 'billing.history', hot: true }
              : { label: '다음 결제일', value: nextText || '—', menu: 'billing.sub' },
          ]

          return (
            <>
              <div style={css.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#111827' }}>{site.name}</h3>
                  {site.status === 'trial' && trialDaysLeft !== null
                    ? badge('#f59e0b', `체험 D-${Math.max(trialDaysLeft, 0)}`)
                    : badge(codeColor('FLOW_STEP', site.status), codeLabel('FLOW_STEP', site.status))}
                </div>

                <p style={{ margin: '0 0 16px', fontSize: 13.5, color: '#4b5563', lineHeight: 1.7 }}>
                  {payLine || customerNextLine(site.status, site.build_type)}
                </p>

                {live && (
                  <a href={sitePublicPath(siteCode)} target="_blank" rel="noreferrer"
                    style={{ ...css.btn, padding: '9px 16px', fontSize: 13, textDecoration: 'none', display: 'inline-block' }}>
                    사이트 보기 →
                  </a>
                )}
              </div>

              {deployPanel}

              {tiles.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {tiles.map(t => (
                    <button key={t.label} type="button" onClick={() => selectMenu(t.menu)}
                      style={{ ...css.card, marginBottom: 0, padding: 18, textAlign: 'left', cursor: 'pointer', border: t.hot ? '1px solid #fecaca' : css.card.border }}>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{t.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: t.hot ? '#ef4444' : '#111827' }}>{t.value}</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )
        })()}

        {menuKey === 'alerts' && (
          <div style={css.card}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#111827' }}>{site.name} 알림</h3>
            {(alertsShown || alerts).length === 0 ? (
              <p style={{ margin: 0, padding: '24px 0', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>새 알림이 없습니다</p>
            ) : (alertsShown || alerts).map((a, i) => (
              <button key={a.id} type="button" onClick={() => selectMenu(a.menu, a.postId)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px',
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  borderBottom: i < (alertsShown || alerts).length - 1 ? '1px solid #f3f4f6' : 'none',
                }}>
                <span style={{ fontSize: 16 }}>{a.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, color: '#111827' }}>{a.text}</span>
                  {a.sub && <span style={{ display: 'block', fontSize: 12, color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.sub}</span>}
                </span>
                {a.at && <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>{new Date(a.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                <span style={{ fontSize: 12, color: '#9ca3af' }}>›</span>
              </button>
            ))}
          </div>
        )}

        {menuKey === 'settings.site' && (
          <>
            <div style={css.card}>
              <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: '#111827' }}>기본 정보 수정</h3>
              <form onSubmit={saveSiteInfo}>
                <div style={{ marginBottom: 16 }}>
                  <label style={css.label}>템플릿</label>
                  <div style={{
                    ...css.input, background: '#f9fafb', color: '#111827', fontWeight: 600,
                    display: 'flex', alignItems: 'center', minHeight: 42,
                  }}>
                    {templateCategoryLabel(siteTemplateCategory(site))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  {[
                    { key: 'name', label: '사이트명 *', ph: '홍길동 카페', req: true },
                    { key: 'phone', label: '전화번호', ph: '02-0000-0000', req: false },
                    { key: 'email', label: '이메일', ph: 'info@mybiz.com', req: false },
                    { key: 'address', label: '주소', ph: '서울시...', req: false },
                  ].map(({ key, label, ph, req }) => (
                    <div key={key}>
                      <label style={css.label}>{label}</label>
                      <input value={siteForm[key]} onChange={e => setSiteForm({ ...siteForm, [key]: e.target.value })} placeholder={ph} required={req} style={css.input} />
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={css.label}>소개글</label>
                  <textarea value={siteForm.description} onChange={e => setSiteForm({ ...siteForm, description: e.target.value })} placeholder="업체 소개..." rows={3} style={{ ...css.input, resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <button type="submit" disabled={saving} style={{ ...css.btn, opacity: saving ? 0.6 : 1 }}>{saving ? '저장 중...' : '저장하기'}</button>
                  {saveMsg && <span style={{ fontSize: 13, color: saveMsg.startsWith('✅') ? '#16a34a' : '#ef4444' }}>{saveMsg}</span>}
                </div>
              </form>
            </div>
          <div style={css.card}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#111827' }}>주소 · 서비스</h3>
            {[
              { label: '플랫폼 주소', value: sitePublicHostname(site.subdomain) },
              { label: '커스텀 도메인', value: site.domain || '미연결' },
              { label: '사이트 상태', value: codeLabel('FLOW_STEP', site.status) },
              { label: '개발 방식', value: codeLabel('BUILD_TYPE', site.build_type) },
              { label: '결제 방식', value: subscription?.payment_method
                ? codeLabel('PAYMENT_METHOD', subscription.payment_method)
                : '미등록' },
            ].map(({ label, value }, i, arr) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', fontSize: 13, borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <span style={{ color: '#6b7280' }}>{label}</span>
                <span style={{ color: '#111827', fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
          </>
        )}

        {menuKey === 'content.posts' && (
          <UserPostsManager
            site={site}
            ownerName={customer?.name}
            boards={boards}
            posts={posts}
            focusPostId={focusPostId}
            onReload={() => fetchBoardData(site.site_id)}
          />
        )}

        {menuKey === 'content.boards' && (
          <UserBoardsManager site={site} boards={boards} posts={posts} onReload={() => fetchBoardData(site.site_id)} />
        )}

        {menuKey === 'support.requests' && (
          <div style={css.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#111827' }}>본사 요청</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>직접 수정이 어려운 부분은 본사에 요청하세요. 3영업일 이내 처리해드립니다.</p>
              </div>
              {!(showTicketForm || tickets.length === 0) && (
                <button type="button" onClick={() => setShowTicketForm(true)} style={{ ...css.btn, whiteSpace: 'nowrap' }}>+ 새 요청</button>
              )}
            </div>
            {ticketMsg && (
              <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, background: ticketMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: ticketMsg.startsWith('✅') ? '#16a34a' : '#ef4444', fontSize: 13 }}>
                {ticketMsg}
              </div>
            )}
            {(showTicketForm || tickets.length === 0) && (
              <div style={{ padding: 20, borderRadius: 10, background: '#f9fafb', marginBottom: tickets.length ? 20 : 0 }}>
              <div style={{ marginBottom: 20 }}>
                <label style={css.label}>요청 유형</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {CATEGORIES.map(c => (
                    <button key={c.value} onClick={() => setTicketForm({ ...ticketForm, category: c.value })} style={{
                      padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                      border: ticketForm.category === c.value ? '2px solid #111827' : '1px solid #e5e7eb',
                      background: ticketForm.category === c.value ? '#111827' : 'white',
                      color: ticketForm.category === c.value ? 'white' : '#374151', fontWeight: 500,
                    }}>{c.icon} {codeLabel('TICKET_CATEGORY', c.value)}</button>
                  ))}
                </div>
              </div>
              <form onSubmit={submitTicket}>
                <div style={{ marginBottom: 16 }}>
                  <label style={css.label}>제목 *</label>
                  <input value={ticketForm.title} onChange={e => setTicketForm({ ...ticketForm, title: e.target.value })} placeholder="예: 메인 페이지 전화번호 수정 요청" required style={css.input} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={css.label}>상세 내용 *</label>
                  <textarea value={ticketForm.content} onChange={e => setTicketForm({ ...ticketForm, content: e.target.value })} placeholder="어떤 부분을 어떻게 수정해주셨으면 하는지 구체적으로 작성해주세요." required rows={5} style={{ ...css.input, resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" style={css.btn}>요청 접수하기</button>
                  {tickets.length > 0 && (
                    <button type="button" onClick={() => setShowTicketForm(false)}
                      style={{ ...css.btn, background: 'white', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                      취소
                    </button>
                  )}
                </div>
              </form>
              </div>
            )}
            {tickets.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tickets.map(ticket => {
                  const overdue = new Date(ticket.deadline_at) < new Date() && ticket.status !== 'resolved'
                  const cat = CATEGORIES.find(c => c.value === ticket.category)
                  return (
                    <div key={ticket.ticket_id} style={{ padding: 18, borderRadius: 10, border: `1px solid ${overdue ? '#fecaca' : '#e5e7eb'}`, background: overdue ? '#fff5f5' : 'white' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {cat && <span>{cat.icon}</span>}
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{ticket.title}</span>
                        </div>
                        {badge(
                          codeColor('TICKET_STATUS', ticket.status),
                          codeLabel('TICKET_STATUS', ticket.status)
                        )}
                      </div>
                      {editTicketId === ticket.ticket_id ? (
                        <div style={{ marginBottom: 12 }}>
                          <input value={editTicketForm.title}
                            onChange={e => setEditTicketForm(f => ({ ...f, title: e.target.value }))}
                            style={{ ...css.input, marginBottom: 8 }} />
                          <textarea value={editTicketForm.content}
                            onChange={e => setEditTicketForm(f => ({ ...f, content: e.target.value }))}
                            rows={4} style={{ ...css.input, resize: 'vertical' }} />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button onClick={() => saveTicketEdit(ticket.ticket_id)} style={{ ...css.btn, padding: '7px 14px', fontSize: 13 }}>저장</button>
                            <button onClick={() => setEditTicketId(null)}
                              style={{ ...css.btn, padding: '7px 14px', fontSize: 13, background: 'white', color: '#6b7280', border: '1px solid #e5e7eb' }}>취소</button>
                          </div>
                        </div>
                      ) : (
                        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#6b7280', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ticket.content}</p>
                      )}

                      {(ticketMsgs[ticket.ticket_id] || []).map(m => (
                        <div key={m.ticket_message_id} style={{
                          margin: '0 0 8px', padding: '12px 14px', borderRadius: 8,
                          background: m.author_type === 'staff' ? '#f9fafb' : '#eff6ff',
                          borderLeft: `3px solid ${m.author_type === 'staff' ? '#111827' : '#93c5fd'}`,
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>
                            {m.author_type === 'staff' ? '본사' : '내 메시지'}
                            <span style={{ fontWeight: 500, marginLeft: 8 }}>{new Date(m.created_at).toLocaleString('ko-KR')}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: 13, color: '#111827', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                        </div>
                      ))}

                      {(() => {
                        const q = ticketQuotes[ticket.ticket_id]
                        if (!q) return null
                        const payBase = `/s/${siteCode}/admin/payment/one-time/${q.payment_id}`
                        return (
                          <div style={{
                            margin: '0 0 12px', padding: '14px 16px', borderRadius: 10,
                            background: '#fffbeb', border: '1px solid #fde68a',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>💰 유료 작업 견적</span>
                              <span style={{ fontSize: 16, fontWeight: 800, color: '#b45309' }}>{q.amount?.toLocaleString()}원</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: 20 }}>
                                {quoteLabel(q.status)}
                              </span>
                            </div>
                            {q.note && <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#92400e', lineHeight: 1.6 }}>{q.note}</p>}
                            {q.status === 'unpaid' && (
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button onClick={() => router.push(`${payBase}/method`)}
                                  style={{ ...css.btn, padding: '9px 18px', fontSize: 13 }}>결제하기 →</button>
                                <button onClick={() => rejectQuote(ticket.ticket_id, q.payment_id)}
                                  style={{ ...css.btn, padding: '9px 14px', fontSize: 13, background: 'white', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                                  거절
                                </button>
                              </div>
                            )}
                            {q.status === 'pending_confirm' && (
                              <p style={{ margin: 0, fontSize: 12.5, color: '#92400e' }}>본사에서 입금을 확인하면 작업이 시작됩니다.</p>
                            )}
                            {q.status === 'paid' && (
                              <p style={{ margin: 0, fontSize: 12.5, color: '#15803d' }}>결제 완료 · 본사가 작업을 진행합니다.</p>
                            )}
                          </div>
                        )
                      })()}

                      {ticket.status !== 'resolved' && editTicketId !== ticket.ticket_id && (
                        <div style={{ marginBottom: 10 }}>
                          <textarea
                            value={ticketReply[ticket.ticket_id] || ''}
                            onChange={e => setTicketReply(prev => ({ ...prev, [ticket.ticket_id]: e.target.value }))}
                            rows={2} placeholder="내용을 덧붙이거나 본사에 답장하세요"
                            style={{ ...css.input, resize: 'vertical' }} />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                            <button onClick={() => sendTicketMessage(ticket.ticket_id)}
                              style={{ ...css.btn, padding: '7px 14px', fontSize: 13 }}>보내기</button>
                            {canCustomerEditTicket(ticket) && (
                              <>
                                <button onClick={() => { setEditTicketId(ticket.ticket_id); setEditTicketForm({ title: ticket.title, content: ticket.content }) }}
                                  style={{ ...css.btn, padding: '7px 14px', fontSize: 13, background: 'white', color: '#6b7280', border: '1px solid #e5e7eb' }}>
                                  요청 수정
                                </button>
                                <button onClick={() => cancelTicket(ticket.ticket_id)}
                                  style={{ ...css.btn, padding: '7px 14px', fontSize: 13, background: 'white', color: '#ef4444', border: '1px solid #fecaca' }}>
                                  요청 취소
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#9ca3af' }}>
                        <span>접수: {new Date(ticket.created_at).toLocaleDateString('ko-KR')}</span>
                        <span style={{ color: overdue ? '#ef4444' : '#9ca3af' }}>
                          {overdue ? '⚠️ 기한초과' : `처리기한: ${new Date(ticket.deadline_at).toLocaleDateString('ko-KR')}`}
                        </span>
                        {ticket.resolved_at && <span style={{ color: '#16a34a' }}>완료: {new Date(ticket.resolved_at).toLocaleDateString('ko-KR')}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {menuKey === 'billing.sub' && (
          <>
            <div style={css.card}>
              <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700, color: '#111827' }}>구독 현황</h3>
              {!subscription && site.build_type === 'managed' ? (
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>
                  월 구독은 <strong>잔금 확인 후 「서비스 시작」</strong>할 때 시작됩니다.<br />
                  검수 중에는 개발비(선금·잔금)만 해당됩니다.
                </p>
              ) : !subscription ? (
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                  사이트 배포 후 구독이 시작됩니다.
                </p>
              ) : (() => {
                const { isTrial, isPendingCancel, isCancelled, canCancel, statusText } = getSubscriptionUiFlags(site, subscription)
                const trialDaysLeft = site?.trial_ends_at
                  ? Math.ceil((new Date(site.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24))
                  : null
                const rows = [
                  { label: '구독 상태', value: statusText },
                  ...(isTrial && trialDaysLeft !== null ? [{ label: '체험 만료일', value: `${new Date(site.trial_ends_at).toLocaleDateString('ko-KR')} (D-${Math.max(trialDaysLeft, 0)})` }] : []),
                  ...(isPendingCancel ? [{ label: '해지 적용일', value: `${new Date(subscription.cancels_at).toLocaleDateString('ko-KR')} (이날까지 이용 가능)` }] : []),
                  { label: '월 구독료', value: `${subscription.amount.toLocaleString()}원` },
                  { label: '결제 방식', value: codeLabel('PAYMENT_METHOD', subscription.payment_method) },
                  ...(!isCancelled && !isPendingCancel
                    ? [{ label: '다음 결제일', value: subscription.next_billing_date ? new Date(subscription.next_billing_date).toLocaleDateString('ko-KR') : '-' }]
                    : []),
                ]
                return (
                  <>
                    {isTrial && (
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
                        {subscription.payment_method === 'manual'
                          ? '⏳ 무료 체험 중입니다. 체험 종료 후 안내 계좌로 입금해 주세요.'
                          : '⏳ 무료 체험 기간입니다. 체험 종료 후 카드로 자동 결제됩니다.'}
                      </div>
                    )}
                    {isPendingCancel && (
                      <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#be123c' }}>
                        🔴 해지가 예약되었습니다. {new Date(subscription.cancels_at).toLocaleDateString('ko-KR')}까지 이용하실 수 있습니다.
                      </div>
                    )}
                    {isCancelled && (
                      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#6b7280' }}>
                        ⛔ 구독이 해지되었습니다. 재구독하면 사이트가 다시 활성화됩니다.
                      </div>
                    )}
                    {rows.map(({ label, value }, i) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', fontSize: 13, borderBottom: i < rows.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <span style={{ color: '#6b7280' }}>{label}</span>
                        <span style={{ color: '#111827', fontWeight: 600 }}>{value}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end' }}>
                      {canCancel && (
                        <button data-testid="admin-cancel-sub" onClick={handleCancelSubscription}
                          style={{ fontSize: 12, color: '#ef4444', background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}>
                          구독 해지
                        </button>
                      )}
                      {isPendingCancel && (
                        <button onClick={handleReinstate}
                          style={{ fontSize: 12, color: '#16a34a', background: 'none', border: '1px solid #bbf7d0', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}>
                          해지 철회하기
                        </button>
                      )}
                      {isCancelled && (
                        <button data-testid="admin-resubscribe" onClick={() => router.push(paymentCardPath(siteCode))}
                          style={{ fontSize: 12, color: 'white', background: '#111827', border: 'none', borderRadius: 6, padding: '7px 16px', cursor: 'pointer', fontWeight: 600 }}>
                          재구독하기 →
                        </button>
                      )}
                    </div>
                  </>
                )
              })()}
            </div>

            <div style={css.card}>
              <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700, color: '#111827' }}>결제 수단</h3>
              {subscription?.payment_method === 'manual' && subscription?.depositor_name ? (
                <div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px', marginBottom: 12, fontSize: 14, fontWeight: 600, color: '#065f46' }}>
                    🏦 {getBankAccountText()}
                  </div>
                  <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
                    입금자명: <strong>{subscription.depositor_name}</strong>
                  </div>
                  <button onClick={() => router.push(paymentMethodUrl(siteCode))}
                    style={{ fontSize: 12, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>
                    결제 수단 변경
                  </button>
                </div>
              ) : paymentMethod ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 44, height: 30, background: '#111827', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 10, color: 'white', fontWeight: 700 }}>{paymentMethod.card_brand?.toUpperCase() || 'CARD'}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                        {paymentMethod.card_name || '카드'} •••• {paymentMethod.card_last4}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>자동결제 등록됨</div>
                    </div>
                  </div>
                  <button onClick={() => router.push(paymentCardPath(siteCode))}
                    style={{ fontSize: 12, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>
                    카드 변경
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>등록된 결제 수단이 없습니다.</p>
                  <button onClick={() => router.push(paymentMethodUrl(siteCode, 'deploy'))}
                    style={{ ...css.btn, fontSize: 12, padding: '8px 16px' }}>
                    결제 수단 등록
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {menuKey === 'billing.history' && (
          <div style={css.card}>
            <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700, color: '#111827' }}>결제 내역</h3>
            {billingHistory.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, textAlign: 'center', padding: '20px 0' }}>결제 내역이 없습니다.</p>
            ) : (
              <div>
                {billingHistory.map((b, i, arr) => {
                  const statusColor = { paid: '#16a34a', unpaid: '#d97706', overdue: '#ef4444' }
                  const statusLabel = codeLabel('BILLING_STATUS', b.status)
                  return (
                    <div key={b.billing_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', fontSize: 13, borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{b.period} 이용료</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                          {b.paid_at ? new Date(b.paid_at).toLocaleDateString('ko-KR') + ' 결제' : '-'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: '#111827' }}>{b.amount.toLocaleString()}원</div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: statusColor[b.status] }}>{statusLabel}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {menuKey === 'settings.account' && (() => {
          const isPendingCancel = getSubscriptionUiFlags(site, subscription).isPendingCancel
          if (isPendingCancel) {
            return (
              <div style={{ ...css.card, border: '1px solid #e5e7eb', background: '#f9fafb' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#374151' }}>계정 종료 안내</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>
                  구독 해지가 예약되어 있습니다.<br />
                  <b>{new Date(subscription.cancels_at).toLocaleDateString('ko-KR')}</b> 이용 종료 후 계정이 자동으로 비활성화됩니다.
                </p>
              </div>
            )
          }
          return (
            <div style={{ ...css.card, border: '1px solid #fee2e2' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#374151' }}>회원 탈퇴</h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>
                탈퇴 시 모든 사이트가 즉시 비활성화됩니다. 고객 데이터는 보관됩니다.
              </p>
              <button onClick={() => setShowWithdrawModal(true)}
                style={{ fontSize: 13, color: '#ef4444', background: 'none', border: '1px solid #fecaca', borderRadius: 7, padding: '7px 16px', cursor: 'pointer' }}>
                회원 탈퇴
              </button>
            </div>
          )
        })()}
      </SiteAdminShell>
    </>
  )
}
