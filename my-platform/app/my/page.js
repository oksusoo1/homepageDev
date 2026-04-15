'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function MySitesPage() {
  const router = useRouter()
  const [customer, setCustomer] = useState(null)
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [isWithdrawn, setIsWithdrawn] = useState(false)
  const [reactivating, setReactivating] = useState(false)
  const [myInquiries, setMyInquiries] = useState([])   // 접수된 내 문의 목록
  const [linkedSiteMap, setLinkedSiteMap] = useState({}) // { inquiry_id: site } — inquiry에 연결된 사이트
  const [showInquiry, setShowInquiry] = useState(false)
  const [inquiryForm, setInquiryForm] = useState({ business_type: '', description: '', phone: '' })
  const [inquirySubmitting, setInquirySubmitting] = useState(false)
  const [inquiryDone, setInquiryDone] = useState(false)

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: cust } = await supabase
      .from('customers').select('*').eq('auth_id', user.id).single()
    if (!cust) { router.push('/login'); return }

    if (cust.status === 'withdrawn') {
      setCustomer(cust)
      setIsWithdrawn(true)
      setLoading(false)
      return
    }

    // withdraw_at이 과거 → 실제 탈퇴 처리
    if (cust.withdraw_at && new Date(cust.withdraw_at) <= new Date()) {
      const { data: custSites } = await supabase
        .from('sites').select('site_id').eq('customer_id', cust.customer_id)
      if (custSites?.length) {
        const siteIds = custSites.map(s => s.site_id)
        await supabase.from('sites').update({ status: 'cancelled' }).in('site_id', siteIds)
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

    const { data: siteList } = await supabase
      .from('sites')
      .select('*, subscriptions(status, amount, next_billing_date)')
      .eq('customer_id', cust.customer_id)
      .order('created_at', { ascending: false })
    setSites(siteList || [])

    // 내 제작 문의 조회
    const { data: inqList } = await supabase
      .from('inquiries')
      .select('*')
      .eq('customer_id', cust.customer_id)
      .order('created_at', { ascending: false })
    setMyInquiries(inqList || [])

    // inquiry에 연결된 사이트 조회 (inquiry_id가 있는 사이트)
    if (inqList?.length) {
      const { data: linkedSites } = await supabase
        .from('sites')
        .select('site_id, subdomain, status, deploy_status, inquiry_id')
        .eq('customer_id', cust.customer_id)
        .not('inquiry_id', 'is', null)
      if (linkedSites?.length) {
        const map = {}
        linkedSites.forEach(s => { map[s.inquiry_id] = s })
        setLinkedSiteMap(map)
      }
    }

    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // 본사 제작 문의 제출
  async function handleInquirySubmit() {
    if (!inquiryForm.business_type || !inquiryForm.description) {
      alert('업종과 원하는 사이트 설명을 입력해주세요.'); return
    }
    setInquirySubmitting(true)
    await supabase.from('inquiries').insert({
      customer_id:   customer.customer_id,
      business_type: inquiryForm.business_type,
      description:   inquiryForm.description,
      phone:         inquiryForm.phone || customer.phone,
      status:        'received',
    })
    setInquirySubmitting(false)
    setInquiryDone(true)
    // 목록 갱신
    const { data: inqList } = await supabase
      .from('inquiries').select('*').eq('customer_id', customer.customer_id).order('created_at', { ascending: false })
    setMyInquiries(inqList || [])
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
      .select('*, subscriptions(status, amount, next_billing_date)')
      .eq('customer_id', customer.customer_id)
      .order('created_at', { ascending: false })
    setSites(siteList || [])
  }

  const STATUS_COLOR = {
    published: '#16a34a',
    draft:     '#d97706',
    suspended: '#dc2626',
    cancelled: '#6b7280',
  }
  const STATUS_BG = {
    published: '#f0fdf4',
    draft:     '#fffbeb',
    suspended: '#fef2f2',
    cancelled: '#f9fafb',
  }
  const STATUS_LABEL = {
    published: '운영중',
    draft:     '준비중',
    suspended: '정지',
    cancelled: '해지',
  }
  const CATEGORY_ICON = {
    cafe:     '☕',
    restaurant: '🍽',
    beauty:   '💇',
    academy:  '📚',
    hospital: '🏥',
    default:  '🏪',
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
                  문의가 접수되었어요!
                </h3>
                <p style={{ margin: '0 0 28px', fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>
                  2~3 영업일 내로 담당자가 연락드릴게요.
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
                  {BUSINESS_TYPES.map(({ value, label, icon }) => (
                    <button key={value} onClick={() => setInquiryForm(f => ({ ...f, business_type: value }))}
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

                {/* 사이트 설명 */}
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#374151' }}>원하는 사이트 설명 *</p>
                <textarea
                  value={inquiryForm.description}
                  onChange={e => setInquiryForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="예) 강남에 있는 카페인데요, 메뉴 소개랑 영업시간, 인스타 링크를 넣고 싶어요."
                  rows={4}
                  style={{
                    width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8,
                    fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                    color: '#111827', marginBottom: 16,
                  }}
                />

                {/* 연락처 */}
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#374151' }}>연락받을 연락처</p>
                <input
                  value={inquiryForm.phone}
                  onChange={e => setInquiryForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="010-0000-0000"
                  style={{
                    width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8,
                    fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    color: '#111827', marginBottom: 24,
                  }}
                />

                <button onClick={handleInquirySubmit} disabled={inquirySubmitting} style={{
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{customer?.name}님</span>
          <button onClick={handleLogout} style={{
            fontSize: 12, color: '#9ca3af', background: 'none',
            border: '1px solid #e5e7eb', borderRadius: 6,
            padding: '5px 12px', cursor: 'pointer',
          }}>로그아웃</button>
        </div>
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
          {sites.length > 0 && (
            <Link href="/templates" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', background: '#111827', color: 'white',
              borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 700,
            }}>
              + 새 사이트
            </Link>
          )}
        </div>

        {/* 진행 중인 제작 문의 상태 카드 */}
        {myInquiries.filter(i => i.status !== 'done').map(inq => {
          const STEP = [
            { key: 'received',  label: '접수완료',  desc: '문의가 접수되었습니다.' },
            { key: 'reviewing', label: '검토/견적',  desc: '담당자가 견적을 검토 중입니다.' },
            { key: 'building',  label: '제작중',     desc: '사이트를 제작하고 있습니다.' },
            { key: 'review',    label: '검수대기',   desc: '제작이 완료되었습니다. 미리보기를 확인해주세요.' },
            { key: 'approved',  label: '승인완료',   desc: '잔금 납부 완료 후 배포 준비 중입니다.' },
          ]
          const currentStep = STEP.findIndex(s => s.key === inq.status)
          const safeStep = currentStep === -1 ? 0 : currentStep
          const BIZ_LABEL = { cafe: '☕ 카페', restaurant: '🍽 식당', salon: '💇 미용실', clinic: '🏥 병원', academy: '📚 학원', general: '🏪 일반', etc: '🏪 기타' }
          const currentDesc = STEP[safeStep]?.desc || ''
          return (
            <div key={inq.inquiry_id} style={{
              background: 'white', borderRadius: 14, border: '1px solid #e5e7eb',
              padding: '20px 24px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase' }}>본사 제작 문의</span>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginTop: 4 }}>
                    {BIZ_LABEL[inq.business_type] || '기타'} 사이트 제작
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>
                    접수일 {new Date(inq.created_at).toLocaleDateString('ko-KR')}
                  </div>
                </div>
                {inq.dev_fee_total && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>개발비</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{inq.dev_fee_total.toLocaleString()}원</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      선금 {inq.down_paid_at ? '✓ 납부' : '미납'} · 잔금 {inq.final_paid_at ? '✓ 납부' : '미납'}
                    </div>
                  </div>
                )}
              </div>

              {/* 진행 단계 표시 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 12 }}>
                {STEP.map((step, i) => (
                  <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: i < STEP.length - 1 ? 1 : 'none' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', fontSize: 12, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: i <= safeStep ? '#111827' : '#f3f4f6',
                        color: i <= safeStep ? 'white' : '#9ca3af',
                      }}>{i < safeStep ? '✓' : i + 1}</div>
                      <span style={{ fontSize: 10, color: i <= safeStep ? '#111827' : '#9ca3af', fontWeight: i === safeStep ? 700 : 400, whiteSpace: 'nowrap' }}>
                        {step.label}
                      </span>
                    </div>
                    {i < STEP.length - 1 && (
                      <div style={{ flex: 1, height: 2, background: i < safeStep ? '#111827' : '#e5e7eb', margin: '0 4px', marginBottom: 16 }} />
                    )}
                  </div>
                ))}
              </div>

              {/* 현재 단계 안내 */}
              <div style={{ fontSize: 12, color: '#6b7280', background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
                💬 {currentDesc}
              </div>

              {/* 단계별 액션 버튼 */}
              {(() => {
                const linkedSite = linkedSiteMap[inq.inquiry_id]
                if (inq.status === 'review' && linkedSite) {
                  return (
                    <a
                      href={`/preview/${linkedSite.subdomain}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '10px 18px', background: '#eff6ff', color: '#2563eb',
                        borderRadius: 8, fontSize: 13, fontWeight: 600,
                        textDecoration: 'none', border: '1px solid #bfdbfe',
                      }}>
                      사이트 미리보기 확인하기 →
                    </a>
                  )
                }
                if (inq.status === 'approved' && linkedSite) {
                  return (
                    <button
                      onClick={() => router.push(`/payment/card?site_id=${linkedSite.site_id}&redirect=deploy`)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '11px 20px', background: '#111827', color: 'white',
                        borderRadius: 8, fontSize: 14, fontWeight: 700,
                        border: 'none', cursor: 'pointer',
                      }}>
                      카드 등록하고 서비스 시작하기 →
                    </button>
                  )
                }
                return null
              })()}
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
              템플릿을 선택하고 몇 가지 정보만 입력하면<br />바로 홈페이지를 만들 수 있어요
            </div>
            <Link href="/templates" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '13px 32px', background: '#111827', color: 'white',
              borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700,
            }}>
              템플릿 선택하러 가기 →
            </Link>
            <div style={{ marginTop: 20, fontSize: 12, color: '#d1d5db' }}>
              {myInquiries.some(i => i.status !== 'done') ? (
                <span style={{ color: '#f59e0b' }}>⏳ 제작 문의가 진행 중입니다</span>
              ) : (
                <>
                  또는 본사에 제작을 맡길 수 있어요 —{' '}
                  <button onClick={() => { setShowInquiry(true); setInquiryDone(false); setInquiryForm({ business_type: '', description: '', phone: customer?.phone || '' }) }}
                    style={{ color: '#9ca3af', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0 }}>
                    문의하기
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* 사이트 카드 목록 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {sites.map(site => {
              const sub = site.subscriptions?.[0]
              const icon = CATEGORY_ICON[site.category] || CATEGORY_ICON.default
              const statusColor = STATUS_COLOR[site.status] || '#6b7280'
              const statusBg = STATUS_BG[site.status] || '#f9fafb'
              const statusLabel = STATUS_LABEL[site.status] || site.status

              return (
                <div key={site.site_id} style={{
                  background: 'white', borderRadius: 14,
                  border: '1px solid #e5e7eb', padding: '20px 24px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  gap: 16,
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#d1d5db'
                    e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#e5e7eb'
                    e.currentTarget.style.boxShadow = 'none'
                  }}>

                  {/* 왼쪽: 아이콘 + 사이트 정보 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
                    {/* 썸네일/아이콘 */}
                    <div style={{
                      width: 56, height: 56, borderRadius: 12,
                      background: '#f3f4f6', border: '1px solid #e5e7eb',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, flexShrink: 0,
                    }}>{icon}</div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                          {site.name}
                        </span>
                        {/* 상태 뱃지 */}
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                          background: statusBg, color: statusColor,
                        }}>{statusLabel}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>
                        {site.subdomain}.myplatform.com
                        {site.domain && (
                          <span style={{ marginLeft: 8, color: '#6b7280' }}>· {site.domain}</span>
                        )}
                      </div>
                      {/* 구독 정보 */}
                      {sub && (
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                          월 ₩{sub.amount?.toLocaleString()} ·{' '}
                          {sub.next_billing_date ? `다음 청구일 ${sub.next_billing_date}` : '청구일 미정'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 오른쪽: 버튼들 */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <a
                      href={`/preview/${site.subdomain}`}
                      target="_blank"
                      style={{
                        padding: '8px 16px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                        background: 'white', color: '#374151',
                        border: '1px solid #e5e7eb', textDecoration: 'none', cursor: 'pointer',
                      }}>
                      사이트 보기
                    </a>
                    <Link href={`/my/${site.subdomain}`} style={{
                      padding: '8px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                      background: '#111827', color: 'white',
                      border: 'none', textDecoration: 'none', cursor: 'pointer',
                    }}>
                      사이트 관리
                    </Link>
                  </div>
                </div>
              )
            })}

            {/* 새 사이트 추가 카드 */}
            <Link href="/templates" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: 'white', borderRadius: 14,
              border: '2px dashed #e5e7eb', padding: '24px',
              textDecoration: 'none', color: '#9ca3af', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#9ca3af'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
              <span style={{ fontSize: 18 }}>+</span>
              새 사이트 만들기
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
