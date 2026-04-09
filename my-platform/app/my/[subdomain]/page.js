'use client'
import { useState, useEffect } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { deploySite as deployAction } from '@/lib/deploy'
import Link from 'next/link'

const TABS = ['내 사이트', '수정 요청', '요청 현황', '결제']
const CATEGORIES = [
  { value: 'text_change', label: '텍스트 수정', icon: '✏️' },
  { value: 'image',       label: '이미지 교체', icon: '🖼️' },
  { value: 'page_add',    label: '페이지 추가', icon: '📄' },
  { value: 'feature',     label: '기능 추가',   icon: '⚙️' },
  { value: 'etc',         label: '기타 문의',   icon: '💬' },
]
const STATUS_LABEL = { open: '접수됨', in_progress: '처리중', resolved: '완료' }
const STATUS_COLOR = { open: '#f59e0b', in_progress: '#3b82f6', resolved: '#22c55e' }

export default function CustomerPortal({ params }) {
  const { subdomain } = use(params)
  const router = useRouter()
  const [tab, setTab] = useState(0)
  const [site, setSite] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [showDeployModal, setShowDeployModal] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [billingHistory, setBillingHistory] = useState([])
  const [saveMsg, setSaveMsg] = useState('')
  const [ticketMsg, setTicketMsg] = useState('')
  const [siteForm, setSiteForm] = useState({ name: '', description: '', address: '', phone: '', email: '' })
  const [ticketForm, setTicketForm] = useState({ title: '', content: '', category: 'etc' })

  useEffect(() => { checkAuthAndFetch() }, [subdomain])

  async function checkAuthAndFetch() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: cust } = await supabase
      .from('customers').select('*').eq('auth_id', user.id).single()
    if (!cust) { router.push('/login'); return }
    setCustomer(cust)

    const { data: siteData } = await supabase
      .from('sites').select('*')
      .eq('subdomain', subdomain)
      .eq('customer_id', cust.customer_id)
      .single()
    if (!siteData) { router.push('/my'); return }

    setSite(siteData)
    setSiteForm({
      name: siteData.name || '', description: siteData.description || '',
      address: siteData.address || '', phone: siteData.phone || '', email: siteData.email || '',
    })
    fetchTickets(siteData.site_id)

    const { data: sub } = await supabase
      .from('subscriptions').select('*').eq('site_id', siteData.site_id).maybeSingle()
    setSubscription(sub)

    const { data: pm } = await supabase
      .from('customer_payment_methods').select('*')
      .eq('customer_id', cust.customer_id).eq('is_active', true).eq('is_default', true).single()
    setPaymentMethod(pm)

    if (sub) {
      const { data: bh } = await supabase
        .from('billing_history').select('*')
        .eq('subscription_id', sub.subscription_id)
        .order('period', { ascending: false })
      setBillingHistory(bh || [])
    }

    setLoading(false)
  }

  async function fetchTickets(siteId) {
    const { data } = await supabase.from('support_tickets').select('*')
      .eq('site_id', siteId).order('created_at', { ascending: false })
    setTickets(data || [])
  }

  async function saveSiteInfo(e) {
    e.preventDefault(); setSaving(true); setSaveMsg('')
    const { error } = await supabase.from('sites')
      .update({ ...siteForm, updated_at: new Date().toISOString() })
      .eq('site_id', site.site_id)
    setSaveMsg(error ? '❌ 저장 실패' : '✅ 저장되었습니다!')
    setSaving(false)
  }

  async function submitTicket(e) {
    e.preventDefault(); setTicketMsg('')
    const { error } = await supabase.from('support_tickets').insert([{
      site_id: site.site_id, customer_id: site.customer_id,
      title: ticketForm.title, content: ticketForm.content, category: ticketForm.category,
      status: 'open', priority: 'normal', deadline_days: 3,
      deadline_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    }])
    if (error) { setTicketMsg('❌ 접수 실패: ' + error.message) }
    else {
      setTicketMsg('✅ 접수되었습니다! 3영업일 이내 처리해드릴게요.')
      setTicketForm({ title: '', content: '', category: 'etc' })
      fetchTickets(site.site_id)
      setTimeout(() => { setTab(2); setTicketMsg('') }, 1500)
    }
  }

  async function handleDeploy() {
    setDeploying(true)
    const { error, trialEndsAt } = await deployAction(site.site_id, site.customer_id, subscription)

    if (!error) {
      if (!subscription) {
        // 새로 생성된 구독 조회
        const { data: newSub } = await supabase.from('subscriptions')
          .select('*').eq('site_id', site.site_id).maybeSingle()
        setSubscription(newSub)
      } else {
        setSubscription(prev => ({ ...prev, status: 'trial' }))
      }
      setSite(prev => ({ ...prev, status: 'published', deploy_status: 'live', trial_ends_at: trialEndsAt }))
      setShowDeployModal(true)
    }
    setDeploying(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

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
    <div style={{ ...css.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#9ca3af', fontSize: 14 }}>로딩 중...</div>
    </div>
  )

  return (
    <div style={css.page}>

      {/* 배포 완료 모달 */}
      {showDeployModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: '40px 36px', maxWidth: 420, width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
            <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: '#111827' }}>배포 완료!</h2>
            <p style={{ margin: '0 0 8px', fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>
              사이트가 공개되었습니다.
            </p>
            <a href={`/preview/${site.subdomain}`} target="_blank"
              style={{ display: 'inline-block', marginBottom: 24, fontSize: 13, color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
              {site.subdomain}.myplatform.com →
            </a>

            <div style={{ background: '#f9fafb', borderRadius: 10, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#111827' }}>💳 카드를 등록하면 사이트가 계속 유지돼요</p>
              <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>월 30,000원 · 언제든지 해지 가능</p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDeployModal(false)}
                style={{ flex: 1, padding: '11px 0', background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                나중에
              </button>
              <button onClick={() => { setShowDeployModal(false); router.push(`/payment/card?site_id=${site.site_id}`) }}
                style={{ flex: 2, padding: '11px 0', background: '#111827', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                카드 등록하기 →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-8 py-3 sm:py-0 sm:h-[60px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
        <div className="flex items-center gap-3">
          <Link href="/my" className="text-xs text-gray-400 no-underline">← 내 사이트</Link>
          <span className="text-gray-200 hidden sm:inline">|</span>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center text-xs text-white font-bold">
              {site.name?.charAt(0)}
            </div>
            <div>
              <div className="text-[13px] font-bold text-gray-900">{site.name}</div>
              <div className="text-[11px] text-gray-400">{site.subdomain}.myplatform.com</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-2.5">
          <a href={`/preview/${subdomain}`} target="_blank" className="text-xs text-gray-500 no-underline px-3 py-1 border border-gray-200 rounded-md hidden sm:inline-block">사이트 보기 →</a>
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${site.status === 'published' ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'}`}>
            {site.status === 'published' ? '● 운영중' : '● ' + site.status}
          </span>
          <button onClick={handleLogout} className="text-xs text-gray-400 bg-transparent border border-gray-200 rounded-md px-3 py-1 cursor-pointer">로그아웃</button>
        </div>
      </div>

      <div className="max-w-[800px] mx-auto px-4 sm:px-5 py-6 sm:py-8">
        {/* 탭 */}
        <div className="flex gap-1 mb-6 sm:mb-7 bg-white rounded-lg p-1 border border-gray-200 w-full sm:w-fit overflow-x-auto">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{
              padding: '8px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, position: 'relative', whiteSpace: 'nowrap',
              background: tab === i ? '#111827' : 'transparent',
              color: tab === i ? 'white' : '#6b7280',
            }}>
              {t}
              {t === '요청 현황' && tickets.filter(t => t.status !== 'resolved').length > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: 'white', borderRadius: '50%', fontSize: 9, padding: '1px 4px', fontWeight: 700 }}>
                  {tickets.filter(t => t.status !== 'resolved').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 탭 0: 내 사이트 */}
        {tab === 0 && (
          <>
            <div style={css.card}>
              <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: '#111827' }}>기본 정보 수정</h3>
              <form onSubmit={saveSiteInfo}>
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

            <div style={{ ...css.card, background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)', border: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'white' }}>🎨 사이트 직접 편집</h3>
                  <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>드래그앤드롭으로 사이트 디자인을 직접 수정할 수 있어요</p>
                </div>
                <Link href={`/editor/${subdomain}`} style={{ padding: '10px 22px', background: 'white', color: '#111827', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', marginLeft: 20 }}>
                  에디터 열기 →
                </Link>
              </div>
            </div>

            <div style={css.card}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#111827' }}>사이트 정보</h3>
              {[
                { label: '플랫폼 주소', value: `${site.subdomain}.myplatform.com` },
                { label: '커스텀 도메인', value: site.domain || '미연결' },
                { label: '사이트 상태', value: site.status === 'published' ? '🟢 운영중' : '🟡 준비중' },
                { label: '개발 방식', value: site.build_type === 'self' ? '직접 개발' : '본사 대리 개발' },
                { label: '결제 방식', value: subscription?.payment_method === 'card' ? '💳 카드 자동결제' : '수동 결제' },
              ].map(({ label, value }, i, arr) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', fontSize: 13, borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <span style={{ color: '#6b7280' }}>{label}</span>
                  <span style={{ color: '#111827', fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>

            {/* 배포 버튼 */}
            {site.deploy_status !== 'live' ? (
              <div style={{ ...css.card, background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)', border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'white' }}>🚀 사이트 배포하기</h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#99f6e4' }}>배포하면 누구나 사이트를 볼 수 있어요</p>
                  </div>
                  <button onClick={handleDeploy} disabled={deploying}
                    style={{ padding: '10px 22px', background: 'white', color: '#0f766e', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: deploying ? 'default' : 'pointer', opacity: deploying ? 0.7 : 1, whiteSpace: 'nowrap', marginLeft: 20 }}>
                    {deploying ? '배포 중...' : '배포하기'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ ...css.card, border: '1px solid #d1fae5', background: '#f0fdf4' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#065f46' }}>✅ 사이트 운영 중</h3>
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>사이트가 정상적으로 배포되어 있어요</p>
                  </div>
                  {subscription?.payment_method !== 'card' && (
                    <button onClick={() => router.push(`/payment/card?site_id=${site.site_id}`)}
                      style={{ padding: '8px 16px', background: '#111827', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 16 }}>
                      카드 등록 →
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* 탭 1: 수정 요청 */}
        {tab === 1 && (
          <div style={css.card}>
            <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#111827' }}>수정 요청 접수</h3>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#9ca3af' }}>수정이 어려운 부분은 본사에 요청하세요. 3영업일 이내 처리해드립니다.</p>
            <div style={{ marginBottom: 20 }}>
              <label style={css.label}>요청 유형</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CATEGORIES.map(c => (
                  <button key={c.value} onClick={() => setTicketForm({ ...ticketForm, category: c.value })} style={{
                    padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                    border: ticketForm.category === c.value ? '2px solid #111827' : '1px solid #e5e7eb',
                    background: ticketForm.category === c.value ? '#111827' : 'white',
                    color: ticketForm.category === c.value ? 'white' : '#374151', fontWeight: 500,
                  }}>{c.icon} {c.label}</button>
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
              {ticketMsg && (
                <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, background: ticketMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: ticketMsg.startsWith('✅') ? '#16a34a' : '#ef4444', fontSize: 13 }}>
                  {ticketMsg}
                </div>
              )}
              <button type="submit" style={css.btn}>요청 접수하기</button>
            </form>
          </div>
        )}

        {/* 탭 3: 결제 */}
        {tab === 3 && (
          <>
            {/* 구독 현황 */}
            <div style={css.card}>
              <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700, color: '#111827' }}>구독 현황</h3>
              {subscription ? (() => {
                const isTrial = subscription.status === 'trial'
                const trialDaysLeft = site?.trial_ends_at
                  ? Math.ceil((new Date(site.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24))
                  : null
                const statusText =
                  subscription.status === 'trial'   ? `🟡 무료 체험중` :
                  subscription.status === 'active'  ? '🟢 이용중' :
                  subscription.status === 'paused'  ? '🟠 일시정지' : '⛔ 해지됨'
                const rows = [
                  { label: '구독 상태', value: statusText },
                  ...(isTrial && trialDaysLeft !== null ? [{ label: '체험 만료일', value: `${new Date(site.trial_ends_at).toLocaleDateString('ko-KR')} (D-${trialDaysLeft > 0 ? trialDaysLeft : 0})` }] : []),
                  { label: '월 구독료', value: `${subscription.amount.toLocaleString()}원` },
                  { label: '결제 방식', value: subscription.payment_method === 'card' ? '💳 카드 자동결제' : '수동 결제' },
                  { label: '다음 결제일', value: subscription.next_billing_date ? new Date(subscription.next_billing_date).toLocaleDateString('ko-KR') : '-' },
                ]
                return (
                  <>
                    {isTrial && (
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
                        ⏳ 무료 체험 기간입니다. 체험 종료 후 카드 등록 시 자동 구독 전환됩니다.
                      </div>
                    )}
                    {rows.map(({ label, value }, i) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', fontSize: 13, borderBottom: i < rows.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <span style={{ color: '#6b7280' }}>{label}</span>
                        <span style={{ color: '#111827', fontWeight: 600 }}>{value}</span>
                      </div>
                    ))}
                  </>
                )
              })() : (
                <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>구독 정보가 없습니다.</p>
              )}
            </div>

            {/* 등록된 카드 */}
            <div style={css.card}>
              <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700, color: '#111827' }}>등록된 카드</h3>
              {paymentMethod ? (
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
                  <button onClick={() => router.push(`/payment/card?site_id=${site.site_id}`)}
                    style={{ fontSize: 12, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>
                    카드 변경
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>등록된 카드가 없습니다.</p>
                  <button onClick={() => router.push(`/payment/card?site_id=${site.site_id}`)}
                    style={{ ...css.btn, fontSize: 12, padding: '8px 16px' }}>
                    카드 등록하기
                  </button>
                </div>
              )}
            </div>

            {/* 결제 내역 */}
            <div style={css.card}>
              <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 700, color: '#111827' }}>결제 내역</h3>
              {billingHistory.length === 0 ? (
                <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, textAlign: 'center', padding: '20px 0' }}>결제 내역이 없습니다.</p>
              ) : (
                <div>
                  {billingHistory.map((b, i, arr) => {
                    const statusColor = { paid: '#16a34a', unpaid: '#d97706', overdue: '#ef4444' }
                    const statusLabel = { paid: '납부완료', unpaid: '미납', overdue: '연체' }
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
                          <span style={{ fontSize: 11, fontWeight: 600, color: statusColor[b.status] }}>{statusLabel[b.status]}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* 탭 2: 요청 현황 */}
        {tab === 2 && (
          <div style={css.card}>
            <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: '#111827' }}>요청 처리 현황</h3>
            {tickets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 14, marginBottom: 16 }}>접수된 요청이 없습니다</div>
                <button onClick={() => setTab(1)} style={css.btn}>수정 요청하기</button>
              </div>
            ) : (
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
                        {badge(STATUS_COLOR[ticket.status], STATUS_LABEL[ticket.status])}
                      </div>
                      <p style={{ margin: '0 0 10px', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{ticket.content}</p>
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
      </div>
    </div>
  )
}
