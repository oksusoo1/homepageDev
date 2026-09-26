'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { requireAuthUser } from '@/lib/auth'
import Link from 'next/link'
import { siteAdminPath, sitePublicPath, sitePublicHostname } from '@/lib/site-paths'
import { paymentMethodPath, oneTimePaymentMethodPath } from '@/lib/payment/paths'
import {
  payableStage,
  pendingOtpOf,
  loadDevFeePayments,
  isFinalPaymentPending,
  stageMeta,
} from '@/lib/payment/one-time'
import {
  flowStepLabel,
  resolveManagedFlowStep,
  resolveSelfFlowStep,
  customerNextLine,
} from '@/lib/flow-step'
import { canCancelManagedIntake } from '@/lib/managed-flow'
import { cancelManagedIntakeAction } from '@/app/my/actions'
import DevFeeSummary from '@/components/DevFeeSummary'
import { onlyActive } from '@/lib/use-flag'
import { loadCommonCodes, codeLabel } from '@/lib/common-codes'
import AuthUserBar from '@/components/AuthUserBar'
import { countUnansweredBySite } from '@/lib/user-board'
import { siteTemplateCategory, templateCategoryMeta } from '@/lib/template-category'

export default function MySitesPage() {
  const router = useRouter()
  const [customer, setCustomer] = useState(null)
  const [sites, setSites] = useState([])
  const [waitingBySite, setWaitingBySite] = useState({}) // { site_id: 답변 대기 글 수 }
  const [loading, setLoading] = useState(true)
  const [isWithdrawn, setIsWithdrawn] = useState(false)
  const [reactivating, setReactivating] = useState(false)
  const [myInquiries, setMyInquiries] = useState([])   // 접수된 내 문의 목록
  const [linkedSiteMap, setLinkedSiteMap] = useState({}) // { inquiry_id: site } — inquiry에 연결된 사이트
  const [pendingOtps, setPendingOtps] = useState([]) // 잔금 입금확인대기 (one_time_payments)
  const [showInquiry, setShowInquiry] = useState(false)
  const [showCreateChoice, setShowCreateChoice] = useState(false)
  const [inquiryForm, setInquiryForm] = useState({
    business_type: '', description: '', phone: '', site_name: '', subdomain: '',
  })
  const [inquirySubmitting, setInquirySubmitting] = useState(false)
  const [inquiryDone, setInquiryDone] = useState(false)
  const [inquiryError, setInquiryError] = useState('')
  const [inquiryErrorField, setInquiryErrorField] = useState('')

  function openCreateChoice() {
    setShowCreateChoice(true)
  }

  function openInquiryModal() {
    setShowCreateChoice(false)
    setShowInquiry(true)
    setInquiryDone(false)
    setInquiryError('')
    setInquiryErrorField('')
    setInquiryForm({
      business_type: '', description: '', phone: customer?.phone || '',
      site_name: '', subdomain: '',
    })
  }

  function patchInquiryForm(patch) {
    setInquiryError('')
    setInquiryErrorField('')
    setInquiryForm(f => ({ ...f, ...patch }))
  }

  /** 사이트 카드「다음」— 셀프/대리 동일 형식 */
  function siteNextHint(site) {
    const inq = site.inquiry_id
      ? myInquiries.find(i => i.inquiry_id === site.inquiry_id)
      : null
    const sub = site.subscriptions?.[0]
    const finalPending = inq
      ? isFinalPaymentPending(pendingOtps, linkedSiteMap[inq.inquiry_id] || site)
      : false

    const step = site.build_type === 'managed'
      ? resolveManagedFlowStep(inq, {
        site: linkedSiteMap[inq?.inquiry_id] || site,
        subscription: sub,
        finalPending,
      })
      : resolveSelfFlowStep(site, { subscription: sub })

    return customerNextLine(step, site.build_type || 'self')
  }

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    const user = await requireAuthUser()
    if (!user) { router.push('/login'); return }

    try { await loadCommonCodes() } catch (_) { /* 라벨 fallback = code */ }

    const { data: cust } = await onlyActive(
      supabase.from('customers').select('*').eq('auth_id', user.id)
    ).single()
    if (!cust) { router.push('/login'); return }

    if (cust.status === 'withdrawn') {
      setCustomer(cust)
      setIsWithdrawn(true)
      setLoading(false)
      return
    }

    // withdraw_at이 과거 → 실제 탈퇴 처리
    if (cust.withdraw_at && new Date(cust.withdraw_at) <= new Date()) {
      const { data: custSites } = await onlyActive(
        supabase.from('sites').select('site_id').eq('customer_id', cust.customer_id)
      )
      if (custSites?.length) {
        const siteIds = custSites.map(s => s.site_id)
        await supabase.from('sites').update({ status: 'suspended' }).in('site_id', siteIds).eq('use_flag', 1)
      }
      await supabase.from('customers')
        .update({ status: 'withdrawn', withdraw_at: null })
        .eq('customer_id', cust.customer_id)
      setCustomer({ ...cust, status: 'withdrawn' })
      setIsWithdrawn(true)
      setLoading(false)
      return
    }

    setCustomer(cust)

    const { data: siteList } = await onlyActive(
      supabase
        .from('sites')
        .select('*, templates(name, category), subscriptions(amount, next_billing_date, cancelled_at, cancels_at)')
        .eq('customer_id', cust.customer_id)
    ).order('created_at', { ascending: false })
    setSites(siteList || [])
    setWaitingBySite(await countUnansweredBySite(supabase, (siteList || []).map(x => x.site_id)))

    // 내 제작 문의 조회
    const { data: inqList } = await onlyActive(
      supabase.from('inquiries').select('*').eq('customer_id', cust.customer_id)
    ).order('created_at', { ascending: false })
    setMyInquiries(inqList || [])

    // inquiry에 연결된 사이트 조회 (inquiry_id가 있는 사이트)
    if (inqList?.length) {
      const { data: linkedSites } = await onlyActive(
        supabase
          .from('sites')
          .select('site_id, subdomain, status, inquiry_id')
          .eq('customer_id', cust.customer_id)
          .not('inquiry_id', 'is', null)
      )
      if (linkedSites?.length) {
        const map = {}
        linkedSites.forEach(s => { map[s.inquiry_id] = s })
        setLinkedSiteMap(map)
      }
    }

    // 잔금 입금확인대기 (계좌이체 신청 후 /my 표시용)
    setPendingOtps(await loadDevFeePayments(supabase, cust.customer_id))

    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // 본사 제작 문의 제출 → 문의 + 사이트(intake) 동시 생성
  async function handleInquirySubmit() {
    const siteName = (inquiryForm.site_name || '').trim()
    const subdomain = (inquiryForm.subdomain || '').trim().toLowerCase()
    const description = (inquiryForm.description || '').trim()

    if (!inquiryForm.business_type) {
      setInquiryError('업종을 선택해주세요.')
      setInquiryErrorField('business_type')
      return
    }
    if (!siteName) {
      setInquiryError('사이트명을 입력해주세요.')
      setInquiryErrorField('site_name')
      return
    }
    if (!subdomain || !/^[a-z0-9-]+$/.test(subdomain)) {
      setInquiryError('사이트 주소명은 영문 소문자·숫자·하이픈만 가능합니다.')
      setInquiryErrorField('subdomain')
      return
    }
    if (!description) {
      setInquiryError('원하는 사이트 설명을 입력해주세요.')
      setInquiryErrorField('description')
      document.getElementById('inquiry-description')?.focus()
      return
    }

    setInquiryError('')
    setInquiryErrorField('')
    setInquirySubmitting(true)
    try {
      const { data: tmpls } = await onlyActive(
        supabase.from('templates').select('template_id').eq('category', inquiryForm.business_type)
      ).order('sort_order').limit(1)
      let templateId = tmpls?.[0]?.template_id || null
      if (!templateId) {
        const { data: anyTmpls } = await onlyActive(
          supabase.from('templates').select('template_id')
        ).order('sort_order').limit(1)
        templateId = anyTmpls?.[0]?.template_id || null
      }

      const { data: inq, error: inqErr } = await supabase.from('inquiries').insert({
        customer_id: customer.customer_id,
        business_type: inquiryForm.business_type,
        description,
        phone: inquiryForm.phone || customer.phone,
      }).select('inquiry_id').single()
      if (inqErr) throw new Error(inqErr.message)

      const site_code = subdomain + '_' + Date.now()
      const { error: sErr } = await supabase.from('sites').insert({
        site_code,
        customer_id: customer.customer_id,
        template_id: templateId,
        name: siteName,
        subdomain,
        description,
        phone: inquiryForm.phone || customer.phone || null,
        email: customer.email || null,
        build_type: 'managed',
        inquiry_id: inq.inquiry_id,
        status: 'intake',
      })
      if (sErr) throw new Error(sErr.message)

      setInquiryDone(true)

      const { data: inqList } = await onlyActive(
        supabase.from('inquiries').select('*').eq('customer_id', customer.customer_id)
      ).order('created_at', { ascending: false })
      setMyInquiries(inqList || [])

      const { data: siteList } = await onlyActive(
        supabase
          .from('sites')
          .select('*, templates(name, category), subscriptions(amount, next_billing_date, cancelled_at, cancels_at)')
          .eq('customer_id', customer.customer_id)
      ).order('created_at', { ascending: false })
      setSites(siteList || [])
    setWaitingBySite(await countUnansweredBySite(supabase, (siteList || []).map(x => x.site_id)))

      if (inqList?.length) {
        const { data: linkedSites } = await onlyActive(
          supabase
            .from('sites')
            .select('site_id, subdomain, status, inquiry_id')
            .eq('customer_id', customer.customer_id)
            .not('inquiry_id', 'is', null)
        )
        const map = {}
        ;(linkedSites || []).forEach(s => { map[s.inquiry_id] = s })
        setLinkedSiteMap(map)
      }
    } catch (err) {
      setInquiryError('접수 오류: ' + (err.message || err))
      setInquiryErrorField('')
    }
    setInquirySubmitting(false)
  }

  async function reloadMyLists() {
    if (!customer?.customer_id) return
    const { data: inqList } = await onlyActive(
      supabase.from('inquiries').select('*').eq('customer_id', customer.customer_id)
    ).order('created_at', { ascending: false })
    setMyInquiries(inqList || [])

    const { data: siteList } = await onlyActive(
      supabase
        .from('sites')
        .select('*, templates(name, category), subscriptions(amount, next_billing_date, cancelled_at, cancels_at)')
        .eq('customer_id', customer.customer_id)
    ).order('created_at', { ascending: false })
    setSites(siteList || [])
    setWaitingBySite(await countUnansweredBySite(supabase, (siteList || []).map(x => x.site_id)))

    const map = {}
    if (inqList?.length) {
      const { data: linkedSites } = await onlyActive(
        supabase
          .from('sites')
          .select('site_id, subdomain, status, inquiry_id')
          .eq('customer_id', customer.customer_id)
          .not('inquiry_id', 'is', null)
      )
      ;(linkedSites || []).forEach(s => { map[s.inquiry_id] = s })
    }
    setLinkedSiteMap(map)
  }

  async function handleCancelManaged(inquiryId) {
    if (!inquiryId) return
    if (!window.confirm('대리 제작 접수를 취소할까요?\n사이트와 문의가 삭제됩니다. (선금 납부 전만 가능)')) return
    const res = await cancelManagedIntakeAction(inquiryId)
    if (!res.ok) {
      alert(res.error)
      return
    }
    await reloadMyLists()
  }

  async function handleReactivate() {
    setReactivating(true)
    await supabase.from('customers')
      .update({ status: 'active' })
      .eq('customer_id', customer.customer_id)
    setIsWithdrawn(false)
    setReactivating(false)
    // 사이트 목록 다시 로드
    const { data: siteList } = await supabase
      .from('sites')
      .select('*, templates(name, category), subscriptions(amount, next_billing_date, cancelled_at, cancels_at)')
      .eq('customer_id', customer.customer_id)
      .order('created_at', { ascending: false })
    setSites(siteList || [])
    setWaitingBySite(await countUnansweredBySite(supabase, (siteList || []).map(x => x.site_id)))
  }

  const STATUS_COLOR = {
    intake: '#b45309',
    deposit: '#b45309',
    building: '#2563eb',
    preview: '#b45309',
    balance: '#b45309',
    pay_method: '#2563eb',
    trial: '#2563eb',
    subscribed: '#16a34a',
    suspended: '#dc2626',
  }
  const STATUS_BG = {
    intake: '#fffbeb',
    deposit: '#fffbeb',
    building: '#eff6ff',
    preview: '#fffbeb',
    balance: '#fffbeb',
    pay_method: '#eff6ff',
    trial: '#eff6ff',
    subscribed: '#f0fdf4',
    suspended: '#fef2f2',
  }
  // 카드 액션: 좁은 화면에서는 아래 줄로 내려감 (고정 폭 금지)
  const cardActionsStyle = {
    display: 'flex',
    gap: 8,
    flexShrink: 0,
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
  }
  const cardHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  }
  const btnView = (disabled) => ({
    padding: '8px 16px', borderRadius: 7, fontSize: 12, fontWeight: 600,
    background: disabled ? '#f9fafb' : 'white',
    color: disabled ? '#d1d5db' : '#374151',
    border: '1px solid #e5e7eb',
    textDecoration: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
  })
  const btnManage = (disabled) => ({
    padding: '8px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700,
    background: disabled ? '#e5e7eb' : '#111827',
    color: disabled ? '#9ca3af' : 'white',
    border: 'none',
    textDecoration: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
  })
  const btnCancel = {
    padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
    background: 'white', color: '#b91c1c',
    border: '1px solid #fecaca', cursor: 'pointer',
  }

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8f7f4', fontFamily: "'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      <div style={{ color: '#9ca3af', fontSize: 14 }}>로딩 중...</div>
    </div>
  )

  if (isWithdrawn) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8f7f4', fontFamily: "'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
      padding: 20,
    }}>
      <div style={{ background: 'white', borderRadius: 16, padding: '48px 36px', maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
        <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: '#111827' }}>다시 돌아오셨군요!</h2>
        <p style={{ margin: '0 0 8px', fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>
          {customer?.name}님의 계정이 탈퇴 상태입니다.<br />
          재활성화하면 기존 사이트 데이터를 그대로 이용할 수 있어요.
        </p>
        <p style={{ margin: '0 0 28px', fontSize: 12, color: '#9ca3af' }}>
          (기존 사이트는 해지 상태로 보관되어 있으며, 재구독 후 다시 운영할 수 있습니다)
        </p>
        <button onClick={handleReactivate} disabled={reactivating} style={{
          width: '100%', padding: '13px 0', background: reactivating ? '#9ca3af' : '#111827',
          color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
          cursor: reactivating ? 'default' : 'pointer', marginBottom: 10,
        }}>
          {reactivating ? '처리 중...' : '계정 재활성화하기'}
        </button>
        <button onClick={handleLogout} style={{
          width: '100%', padding: '12px 0', background: 'white', color: '#9ca3af',
          border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, cursor: 'pointer',
        }}>
          로그아웃
        </button>
      </div>
    </div>
  )

  const BUSINESS_TYPES = [
    { value: 'cafe',       label: '카페',    icon: '☕' },
    { value: 'restaurant', label: '식당',    icon: '🍽' },
    { value: 'salon',      label: '미용실',  icon: '💇' },
    { value: 'clinic',     label: '병원',    icon: '🏥' },
    { value: 'academy',    label: '학원',    icon: '📚' },
    { value: 'general',    label: '기타',    icon: '🏪' },
  ]

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f7f4',
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>

      {/* 새 사이트 — 셀프 / 대리 선택 */}
      {showCreateChoice && (
        <div onClick={() => setShowCreateChoice(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: 16, padding: '32px 28px',
            width: '100%', maxWidth: 440, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#111827' }}>
              사이트를 어떻게 만들까요?
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#9ca3af', lineHeight: 1.5 }}>
              직접 만들거나, 본사에 제작을 맡길 수 있어요.
            </p>
            <button
              type="button"
              data-testid="my-create-self"
              onClick={() => { setShowCreateChoice(false); router.push('/templates') }}
              style={{
                width: '100%', textAlign: 'left', padding: '16px 18px', marginBottom: 10,
                border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>직접 만들기</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>템플릿을 고르고 바로 편집·배포합니다</div>
            </button>
            <button
              type="button"
              data-testid="my-create-managed"
              onClick={openInquiryModal}
              style={{
                width: '100%', textAlign: 'left', padding: '16px 18px', marginBottom: 16,
                border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>본사에 맡기기</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>상담·견적 후 본사가 제작합니다 (개발비)</div>
            </button>
            <button
              type="button"
              onClick={() => setShowCreateChoice(false)}
              style={{
                width: '100%', padding: '10px', border: 'none', background: 'transparent',
                color: '#9ca3af', fontSize: 13, cursor: 'pointer',
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 본사 제작 문의 모달 */}
      {showInquiry && (
        <div onClick={() => setShowInquiry(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: 16, padding: '36px 32px',
            width: '100%', maxWidth: 480, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          }}>
            {inquiryDone ? (
              /* 접수 완료 화면 */
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800, color: '#111827' }}>
                  접수가 완료되었어요!
                </h3>
                <p style={{ margin: '0 0 28px', fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>
                  내 사이트 목록에 카드가 추가되었습니다.<br />
                  담당자가 연락·견적 안내를 드릴게요.
                </p>
                <button onClick={() => setShowInquiry(false)} style={{
                  padding: '11px 32px', background: '#111827', color: 'white',
                  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}>확인</button>
              </div>
            ) : (
              /* 문의 폼 */
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#111827' }}>본사 제작 문의</h3>
                  <button onClick={() => setShowInquiry(false)} style={{
                    background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1,
                  }}>✕</button>
                </div>

                {/* 업종 선택 */}
                <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#374151' }}>업종 선택 *</p>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20,
                  padding: inquiryErrorField === 'business_type' ? 6 : 0,
                  borderRadius: 10,
                  outline: inquiryErrorField === 'business_type' ? '2px solid #ef4444' : 'none',
                }}>
                  {BUSINESS_TYPES.map(({ value, label, icon }) => (
                    <button key={value} type="button"
                      data-testid={`inquiry-type-${value}`}
                      onClick={() => patchInquiryForm({ business_type: value })}
                      style={{
                        padding: '12px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        border: inquiryForm.business_type === value ? '2px solid #111827' : '2px solid #e5e7eb',
                        background: inquiryForm.business_type === value ? '#111827' : 'white',
                        color: inquiryForm.business_type === value ? 'white' : '#374151',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      }}>
                      <span style={{ fontSize: 22 }}>{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>

                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#374151' }}>사이트명 *</p>
                <input
                  data-testid="inquiry-name"
                  value={inquiryForm.site_name}
                  onChange={e => patchInquiryForm({ site_name: e.target.value })}
                  placeholder="예) 마곡카페"
                  style={{
                    width: '100%', padding: '10px 14px',
                    border: inquiryErrorField === 'site_name' ? '1px solid #ef4444' : '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#111827', marginBottom: 16,
                  }}
                />

                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#374151' }}>
                  사이트 주소명 * <span style={{ fontWeight: 500, color: '#9ca3af' }}>(영문 소문자)</span>
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                  <input
                    data-testid="inquiry-subdomain"
                    value={inquiryForm.subdomain}
                    onChange={e => patchInquiryForm({
                      subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                    })}
                    placeholder="magokcafe"
                    style={{
                      flex: 1, padding: '10px 14px',
                      border: inquiryErrorField === 'subdomain' ? '1px solid #ef4444' : '1px solid #e5e7eb',
                      borderRadius: 8,
                      fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#111827',
                    }}
                  />
                  <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>.myplatform.com</span>
                </div>

                {/* 사이트 설명 */}
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#374151' }}>원하는 사이트 설명 *</p>
                <textarea
                  id="inquiry-description"
                  data-testid="inquiry-description"
                  value={inquiryForm.description}
                  onChange={e => patchInquiryForm({ description: e.target.value })}
                  placeholder="예) 강남에 있는 카페인데요, 메뉴 소개랑 영업시간, 인스타 링크를 넣고 싶어요."
                  rows={4}
                  style={{
                    width: '100%', padding: '10px 14px',
                    border: inquiryErrorField === 'description' ? '1px solid #ef4444' : '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                    color: '#111827', marginBottom: 16,
                  }}
                />

                {/* 연락처 */}
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#374151' }}>연락받을 연락처</p>
                <input
                  value={inquiryForm.phone}
                  onChange={e => patchInquiryForm({ phone: e.target.value })}
                  placeholder="010-0000-0000"
                  style={{
                    width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8,
                    fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    color: '#111827', marginBottom: 16,
                  }}
                />

                {inquiryError && (
                  <p style={{
                    margin: '0 0 12px', padding: '10px 12px', borderRadius: 8,
                    background: '#fef2f2', border: '1px solid #fecaca',
                    color: '#b91c1c', fontSize: 13, fontWeight: 600,
                  }}>
                    {inquiryError}
                  </p>
                )}

                <button type="button" data-testid="inquiry-submit" onClick={handleInquirySubmit} disabled={inquirySubmitting} style={{
                  width: '100%', padding: '13px 0', background: inquirySubmitting ? '#9ca3af' : '#111827',
                  color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
                  cursor: inquirySubmitting ? 'default' : 'pointer',
                }}>
                  {inquirySubmitting ? '접수 중...' : '문의 접수하기'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div style={{
        background: 'white', borderBottom: '1px solid #e5e7eb',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7, background: '#111827',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, color: 'white', fontWeight: 800,
          }}>M</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>내 사이트</span>
        </div>
        <AuthUserBar variant="light" />
      </div>

      {/* 콘텐츠 */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 20px' }}>

        {/* 타이틀 + 새 사이트 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h2 style={{ margin: '0 0 5px', fontSize: 20, fontWeight: 700, color: '#111827' }}>
              안녕하세요, {customer?.name}님 👋
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
              {sites.length > 0 ? `총 ${sites.length}개의 사이트가 있어요` : '첫 번째 사이트를 만들어보세요'}
            </p>
          </div>
          <button
            type="button"
            data-testid="my-new-site"
            onClick={openCreateChoice}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', background: '#111827', color: 'white',
              borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            + 새 사이트
          </button>
        </div>

        {/* 대리 문의 — 사이트 생기기 전: 사이트 카드와 같은 짧은 형식 */}
        {myInquiries
          .filter(i => i.status !== 'done' && !linkedSiteMap[i.inquiry_id])
          .map(inq => {
          const finalPending = isFinalPaymentPending(pendingOtps, null)
          const downPending = !!pendingOtpOf(pendingOtps, 'down', linkedSiteMap[inq.inquiry_id]?.site_id)
          const flowStep = resolveManagedFlowStep(inq, { site: null, finalPending })
          const stepLabel = codeLabel('FLOW_STEP', flowStep, flowStepLabel(flowStep))
          const nextHint = downPending
            ? '다음: 선금 입금 확인을 기다리는 중입니다.'
            : finalPending
              ? '다음: 잔금 입금 확인을 기다리는 중입니다.'
              : customerNextLine(flowStep, 'managed')
          const payStage = payableStage(linkedSiteMap[inq.inquiry_id] || null, inq)
          const payBlocked = payStage === 'down' ? downPending : finalPending

          return (
            <div key={inq.inquiry_id} style={{
              background: 'white', borderRadius: 14, border: '1px solid #e5e7eb',
              padding: '20px 24px', marginBottom: 16,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={cardHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 200px' }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 12,
                    background: '#fffbeb', border: '1px solid #fde68a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, flexShrink: 0,
                  }}>🏗</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                        {codeLabel('BUSINESS_TYPE', inq.business_type, '기타')} 사이트 제작
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: '#fffbeb', color: '#b45309',
                      }}>{stepLabel}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: '#fffbeb', color: '#b45309',
                      }}>{codeLabel('BUILD_TYPE', 'managed', '대리')}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>
                      접수일 {new Date(inq.created_at).toLocaleDateString('ko-KR')}
                      {inq.dev_fee_total ? ` · 개발비 ${inq.dev_fee_total.toLocaleString()}원` : ''}
                    </div>
                  </div>
                </div>

                {/* 보기 → 관리 → (취소) 순서 고정 */}
                <div style={cardActionsStyle}>
                  <button
                    type="button"
                    disabled
                    title="사이트가 준비되면 이용할 수 있어요"
                    style={btnView(true)}
                  >
                    사이트 보기
                  </button>
                  <button
                    type="button"
                    disabled
                    title="사이트가 준비되면 이용할 수 있어요"
                    style={btnManage(true)}
                  >
                    사이트 관리
                  </button>
                  {canCancelManagedIntake(inq, linkedSiteMap[inq.inquiry_id] || null) && (
                    <button
                      type="button"
                      onClick={() => handleCancelManaged(inq.inquiry_id)}
                      style={btnCancel}
                    >
                      접수 취소
                    </button>
                  )}
                </div>
              </div>

              <div style={{
                fontSize: 12, color: '#374151', background: '#f9fafb',
                borderRadius: 8, padding: '10px 14px', border: '1px solid #f3f4f6',
              }}>
                {nextHint}
              </div>

              {inq.dev_fee_total && (payStage || downPending || finalPending) && (
                <DevFeeSummary inquiry={inq} highlight={payStage || 'none'}
                  finalPending={finalPending} downPending={downPending} />
              )}

              {payStage && !payBlocked && (
                <button
                  data-testid={payStage === 'down' ? 'my-pay-down' : 'my-pay-final'}
                  onClick={() => router.push(oneTimePaymentMethodPath(inq.inquiry_id, payStage))}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '11px 20px', background: '#111827', color: 'white',
                    borderRadius: 8, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                  }}
                >
                  {stageMeta(payStage).label} 결제하기 →
                </button>
              )}
            </div>
          )
        })}

        {/* 사이트 없을 때 */}
        {sites.length === 0 ? (
          <div style={{
            background: 'white', borderRadius: 16, border: '2px dashed #e5e7eb',
            padding: '72px 40px', textAlign: 'center',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16, background: '#f3f4f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, margin: '0 auto 20px',
            }}>🌐</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              아직 사이트가 없어요
            </div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 32, lineHeight: 1.6 }}>
              직접 만들거나, 본사에 제작을 맡길 수 있어요
            </div>
            <button
              type="button"
              onClick={openCreateChoice}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '13px 32px', background: '#111827', color: 'white',
                borderRadius: 10, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              새 사이트 만들기 →
            </button>
            {myInquiries.some(i => i.status !== 'done') && (
              <div style={{ marginTop: 20, fontSize: 12, color: '#f59e0b' }}>
                ⏳ 위쪽 카드에서 본사 제작 진행 상황을 확인할 수 있어요
              </div>
            )}
          </div>
        ) : (
          /* 사이트 카드 목록 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {sites.map(site => {
              const sub = site.subscriptions?.[0]
              const tmplCat = siteTemplateCategory(site)
              const tmplMeta = templateCategoryMeta(tmplCat || 'general')
              const icon = tmplMeta.icon
              const statusColor = STATUS_COLOR[site.status] || '#6b7280'
              const statusBg = STATUS_BG[site.status] || '#f9fafb'
              const statusLabel = codeLabel('FLOW_STEP', site.status, flowStepLabel(site.status))
              const nextHint = siteNextHint(site)
              const buildLabel = codeLabel('BUILD_TYPE', site.build_type)
              // 대리: 부분공개(검토) 전까지 보기/관리 비활성
              const managedLocked = site.build_type === 'managed'
                && !['preview', 'balance', 'pay_method', 'trial', 'subscribed', 'suspended'].includes(site.status)

              return (
                <div key={site.site_id} style={{
                  background: 'white', borderRadius: 14,
                  border: '1px solid #e5e7eb', padding: '20px 24px',
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#d1d5db'
                    e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#e5e7eb'
                    e.currentTarget.style.boxShadow = 'none'
                  }}>

                  <div style={cardHeaderStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 200px' }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: 12,
                        background: '#f3f4f6', border: '1px solid #e5e7eb',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 24, flexShrink: 0,
                      }}>{icon}</div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                            {site.name}
                          </span>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                            background: '#eff6ff', color: '#1d4ed8',
                          }}>{tmplMeta.label}</span>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                            background: statusBg, color: statusColor,
                          }}>{statusLabel}</span>
                          {waitingBySite[site.site_id] > 0 && (
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                              background: '#fee2e2', color: '#b91c1c',
                            }}>답변 대기 {waitingBySite[site.site_id]}</span>
                          )}
                          {site.build_type && (
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                              background: site.build_type === 'managed' ? '#fffbeb' : '#f3f4f6',
                              color: site.build_type === 'managed' ? '#b45309' : '#6b7280',
                            }}>{buildLabel || (site.build_type === 'managed' ? '대리' : '직접')}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>
                          {sitePublicHostname(site.subdomain)}
                          {site.domain && (
                            <span style={{ marginLeft: 8, color: '#6b7280' }}>· {site.domain}</span>
                          )}
                        </div>
                        {sub && (
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                            월 ₩{sub.amount?.toLocaleString()} ·{' '}
                            {sub.next_billing_date ? `다음 청구일 ${sub.next_billing_date}` : '청구일 미정'}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={cardActionsStyle}>
                      {managedLocked ? (
                        <>
                          <button type="button" disabled title="본사 제작·검수 후 이용할 수 있어요" style={btnView(true)}>
                            사이트 보기
                          </button>
                          <button type="button" disabled title="본사 제작·검수 후 이용할 수 있어요" style={btnManage(true)}>
                            사이트 관리
                          </button>
                        </>
                      ) : (
                        <>
                          <a href={sitePublicPath(site.subdomain)} target="_blank" style={btnView(false)}>
                            사이트 보기
                          </a>
                          <Link href={siteAdminPath(site.subdomain)} data-testid={`my-site-admin-${site.subdomain}`} style={btnManage(false)}>
                            사이트 관리
                          </Link>
                        </>
                      )}
                      {site.build_type === 'managed' && site.inquiry_id && (() => {
                        const inq = myInquiries.find(i => i.inquiry_id === site.inquiry_id)
                        if (!canCancelManagedIntake(inq, site)) return null
                        return (
                          <button
                            type="button"
                            onClick={() => handleCancelManaged(site.inquiry_id)}
                            style={btnCancel}
                          >
                            접수 취소
                          </button>
                        )
                      })()}
                    </div>
                  </div>

                  {nextHint && (
                    <div style={{
                      fontSize: 12, color: '#374151', background: '#f9fafb',
                      borderRadius: 8, padding: '10px 14px', border: '1px solid #f3f4f6',
                    }}>
                      {nextHint}
                    </div>
                  )}

                  {site.build_type === 'managed' && (() => {
                    const inq = site.inquiry_id
                      ? myInquiries.find(i => i.inquiry_id === site.inquiry_id)
                      : null
                    if (!inq) return null
                    const finalPending = isFinalPaymentPending(pendingOtps, site)
                    const downPending = !!pendingOtpOf(pendingOtps, 'down', site.site_id)
                    const payStage = payableStage(site, inq)
                    const payBlocked = payStage === 'down' ? downPending : finalPending
                    if (!payStage && !downPending && !finalPending && site.status !== 'pay_method') return null
                    return (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {(payStage || downPending || finalPending) && (
                          <DevFeeSummary inquiry={inq} highlight={payStage || 'none'}
                            finalPending={finalPending} downPending={downPending} />
                        )}
                        {payStage && !payBlocked && (
                          <button
                            type="button"
                            data-testid={payStage === 'down' ? 'my-pay-down' : 'my-pay-final'}
                            onClick={() => router.push(oneTimePaymentMethodPath(inq.inquiry_id, payStage))}
                            style={{
                              padding: '10px 16px', background: '#111827', color: 'white',
                              borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                            }}
                          >
                            {stageMeta(payStage).label} 결제하기 →
                          </button>
                        )}
                        {site.status === 'pay_method' && (
                          <button
                            type="button"
                            onClick={() => router.push(paymentMethodPath(site.subdomain, 'deploy'))}
                            style={{
                              padding: '10px 16px', background: '#111827', color: 'white',
                              borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                            }}
                          >
                            결제 수단 등록 · 서비스 시작 →
                          </button>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
