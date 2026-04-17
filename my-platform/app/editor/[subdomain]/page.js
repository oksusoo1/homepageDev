'use client'
import { useState, useEffect } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { deploySite as deployAction } from '@/lib/deploy'
import Link from 'next/link'

const PRESET_COLORS = ['#1c1917', '#1e3a5f', '#14532d', '#4c1d95', '#7f1d1d', '#0f172a']

// activeField에 따라 미리보기 요소 하이라이트 스타일
function hl(field, activeField) {
  if (activeField !== field) return {}
  return {
    outline: '2px solid #3b82f6',
    outlineOffset: 3,
    borderRadius: 4,
    position: 'relative',
  }
}

function SitePreview({ site, content, contact, activeField, onFieldClick }) {
  const [hoveredField, setHoveredField] = useState(null)
  const hero = content?.hero || {}
  const sections = content?.sections || {}

  // 클릭/호버 가능한 요소 스타일
  function fieldStyle(field) {
    const base = { position: 'relative', cursor: 'pointer' }
    if (activeField === field) return { ...base, outline: '2px solid #3b82f6', outlineOffset: 3, borderRadius: 4 }
    if (hoveredField === field) return { ...base, outline: '2px dashed #93c5fd', outlineOffset: 3, borderRadius: 4 }
    return base
  }

  function bindField(field) {
    return {
      onClick:      (e) => { e.stopPropagation(); onFieldClick(field) },
      onMouseEnter: (e) => { e.stopPropagation(); setHoveredField(field) },
      onMouseLeave: () => setHoveredField(null),
    }
  }

  return (
    <div style={{ fontFamily: "'Georgia', serif", background: '#fafaf9', minHeight: '100%' }}>
      {/* 헤더 */}
      <header style={{
        background: hero.bgColor, color: 'white',
        padding: '0 24px', height: 48,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        ...hl('hero.bgColor', activeField),
      }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{site.name}</span>
        <nav style={{ display: 'flex', gap: 16, fontSize: 11, color: '#d6d3d1' }}>
          <span>홈</span><span>게시판</span><span>문의</span>
        </nav>
      </header>

      {/* 히어로 — 섹션 전체 클릭 시 배경색 편집 */}
      <section
        style={{
          background: `linear-gradient(135deg, ${hero.bgColor} 0%, #292524 60%, #44403c 100%)`,
          color: 'white', padding: '70px 24px', textAlign: 'center',
          position: 'relative',
          ...fieldStyle('hero.bgColor'),
        }}
        {...bindField('hero.bgColor')}
      >
        {(activeField === 'hero.bgColor' || hoveredField === 'hero.bgColor') && (
          <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap', zIndex: 10 }}>
            배경 색상
          </div>
        )}
        <p style={{ fontSize: 9, letterSpacing: 3, color: '#a8a29e', marginBottom: 14, textTransform: 'uppercase' }}>Welcome</p>

        {/* 메인 제목 */}
        <div style={{ display: 'block', width: 'fit-content', margin: '0 auto', ...fieldStyle('hero.title') }} {...bindField('hero.title')}>
          {(activeField === 'hero.title' || hoveredField === 'hero.title') && (
            <div style={{ position: 'absolute', top: -22, left: 0, fontSize: 10, background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
              메인 제목
            </div>
          )}
          <h2 style={{ fontSize: 30, fontWeight: 700, margin: '0 0 16px', lineHeight: 1.2 }}>
            {hero.title}
          </h2>
        </div>

        {/* 부제목 */}
        {hero.subtitle && (
          <div style={{ display: 'block', width: 'fit-content', maxWidth: 420, margin: '0 auto', ...fieldStyle('hero.subtitle') }} {...bindField('hero.subtitle')}>
            {(activeField === 'hero.subtitle' || hoveredField === 'hero.subtitle') && (
              <div style={{ position: 'absolute', top: -22, left: 0, fontSize: 10, background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                부제목
              </div>
            )}
            <p style={{ fontSize: 13, color: '#d6d3d1', lineHeight: 1.9, margin: '0 0 28px' }}>
              {hero.subtitle}
            </p>
          </div>
        )}

        {/* CTA 버튼 */}
        <div style={{ display: 'block', width: 'fit-content', margin: '0 auto', ...fieldStyle('hero.ctaText') }} {...bindField('hero.ctaText')}>
          {(activeField === 'hero.ctaText' || hoveredField === 'hero.ctaText') && (
            <div style={{ position: 'absolute', top: -22, left: 0, fontSize: 10, background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
              버튼 텍스트
            </div>
          )}
          <button style={{
            padding: '10px 26px', background: 'white', color: '#1c1917',
            borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            {hero.ctaText}
          </button>
        </div>
      </section>

      {/* 정보 카드 */}
      {sections.showInfo && (contact.address || contact.phone || contact.email) && (
        <section style={{ maxWidth: 640, margin: '48px auto', padding: '0 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              { icon: '📍', label: '주소',   field: 'contact.address', value: contact.address },
              { icon: '📞', label: '전화',   field: 'contact.phone',   value: contact.phone   },
              { icon: '✉️', label: '이메일', field: 'contact.email',   value: contact.email   },
            ].map(({ icon, label, field, value }) => value && (
              <div key={label}
                style={{ background: 'white', borderRadius: 10, padding: '22px 14px', textAlign: 'center', border: '1px solid #e7e5e4', ...fieldStyle(field) }}
                {...bindField(field)}
              >
                {(activeField === field || hoveredField === field) && (
                  <div style={{ position: 'absolute', top: -22, left: 0, fontSize: 10, background: '#3b82f6', color: 'white', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                    {label}
                  </div>
                )}
                <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontSize: 9, color: '#a8a29e', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
                <div style={{ fontSize: 12, color: '#1c1917', fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 최근 게시물 */}
      {sections.showBoard && (
        <section style={{ maxWidth: 640, margin: '0 auto 60px', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: '#1c1917' }}>최근 공지</h3>
            <span style={{ fontSize: 12, color: '#78716c' }}>전체보기 →</span>
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px', background: 'white',
              border: '1px solid #e7e5e4', borderTop: i > 1 ? 'none' : '1px solid #e7e5e4',
              borderRadius: i === 1 ? '10px 10px 0 0' : i === 3 ? '0 0 10px 10px' : 0,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1c1917', marginBottom: 3 }}>공지사항 제목 예시 {i}</div>
                <div style={{ fontSize: 11, color: '#a8a29e' }}>관리자</div>
              </div>
              <div style={{ fontSize: 11, color: '#a8a29e' }}>2026.03.31</div>
            </div>
          ))}
        </section>
      )}

      {/* 푸터 */}
      <footer style={{ background: '#1c1917', color: '#78716c', textAlign: 'center', padding: '24px', fontSize: 11 }}>
        <p style={{ margin: '0 0 4px' }}>© 2026 {site.name}</p>
        <p style={{ margin: 0, fontSize: 10 }}>Powered by MyPlatform</p>
      </footer>
    </div>
  )
}

export default function EditorPage({ params }) {
  const { subdomain } = use(params)
  const router = useRouter()
  const [site, setSite] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [contact, setContact] = useState({ address: '', phone: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [showDeployModal, setShowDeployModal] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [activeSection, setActiveSection] = useState('hero')
  const [activeField, setActiveField] = useState(null)   // 현재 포커스된 필드
  const [previewDevice, setPreviewDevice] = useState('desktop')
  const [mobileView, setMobileView] = useState('preview') // 'panel' | 'preview' (모바일 전용)

  useEffect(() => { init() }, [subdomain])

  async function init() {
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

    // 연락처 초기화 (sites 테이블 직접 필드)
    setContact({
      address: siteData.address || '',
      phone:   siteData.phone   || '',
      email:   siteData.email   || '',
    })

    // 저장된 content가 있으면 그걸 쓰고, 없으면 사이트 기본값으로 초기화
    const saved = siteData.content || {}
    setContent({
      hero: {
        title:    saved.hero?.title    ?? siteData.name,
        subtitle: saved.hero?.subtitle ?? siteData.description ?? '',
        ctaText:  saved.hero?.ctaText  ?? '문의하기',
        bgColor:  saved.hero?.bgColor  ?? '#1c1917',
      },
      sections: {
        showInfo:    saved.sections?.showInfo    ?? true,
        showBoard:   saved.sections?.showBoard   ?? true,
        showHours:   saved.sections?.showHours   ?? true,
        showGallery: saved.sections?.showGallery ?? true,
        showSns:     saved.sections?.showSns     ?? true,
      },
      hours: saved.hours || {},
      sns:   saved.sns   || {},
      gallery: saved.gallery || [],
    })

    setLoading(false)
  }

  async function save() {
    setSaving(true); setSaveMsg('')
    const { error } = await supabase.from('sites')
      .update({
        content,
        address: contact.address,
        phone:   contact.phone,
        email:   contact.email,
        updated_at: new Date().toISOString(),
      })
      .eq('site_id', site.site_id)
    setSaveMsg(error ? '❌ 저장 실패' : '✅ 저장됨')
    setSaving(false)
    setTimeout(() => setSaveMsg(''), 2500)
  }

  function updateHero(key, value) {
    setContent(prev => ({ ...prev, hero: { ...prev.hero, [key]: value } }))
  }

  function updateSections(key, value) {
    setContent(prev => ({ ...prev, sections: { ...prev.sections, [key]: value } }))
  }

  async function handleDeploy() {
    // 카드 등록 여부 확인 — 없으면 카드 등록 페이지로 이동 (등록 후 자동 배포)
    const { data: card } = await supabase
      .from('customer_payment_methods')
      .select('payment_method_id')
      .eq('customer_id', customer.customer_id)
      .eq('is_active', true)
      .maybeSingle()

    if (!card) {
      router.push(`/payment/card?site_id=${site.site_id}&redirect=deploy`)
      return
    }

    setDeploying(true)
    const { data: existingSub } = await supabase
      .from('subscriptions').select('subscription_id').eq('site_id', site.site_id).maybeSingle()

    const { error, trialEndsAt } = await deployAction(site.site_id, site.customer_id, existingSub, site)

    if (!error) {
      setSite(prev => ({ ...prev, status: 'published', deploy_status: 'live', trial_ends_at: trialEndsAt }))
      setShowDeployModal(true)
    }
    setDeploying(false)
  }

  // 미리보기 요소 클릭 → 해당 필드 활성화 + 왼쪽 탭 자동 전환
  function handlePreviewFieldClick(field) {
    setActiveField(field)
    if (field.startsWith('hero'))    setActiveSection('hero')
    if (field.startsWith('contact')) setActiveSection('contact')
    if (field.startsWith('hours'))   setActiveSection('hours')
    if (field.startsWith('sns'))     setActiveSection('sns')
  }

  if (loading || !content) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111827' }}>
      <div style={{ color: '#9ca3af', fontSize: 14 }}>로딩 중...</div>
    </div>
  )

  const NAV_ITEMS = [
    { id: 'hero',     icon: '🏠', label: '히어로' },
    { id: 'contact',  icon: '📍', label: '연락처' },
    { id: 'hours',    icon: '🕐', label: '영업시간' },
    { id: 'sns',      icon: '🔗', label: 'SNS' },
    { id: 'sections', icon: '👁', label: '섹션' },
  ]

  // 패널 입력 필드 스타일 — activeField 이면 파란 테두리
  function inputStyle(field) {
    return {
      width: '100%', padding: '8px 12px',
      border: activeField === field ? '1.5px solid #3b82f6' : '1px solid #374151',
      borderRadius: 7, fontSize: 13, outline: 'none',
      color: 'white', background: activeField === field ? '#1e3050' : '#1f2937',
      boxSizing: 'border-box', transition: 'border 0.15s, background 0.15s',
    }
  }

  // 패널 라벨 스타일 — activeField 이면 파란색
  function labelStyle(field) {
    return {
      display: 'block', fontSize: 11, fontWeight: 600,
      color: activeField === field ? '#60a5fa' : '#9ca3af',
      marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
      transition: 'color 0.15s',
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a] font-sans">

      {/* 배포 완료 모달 */}
      {showDeployModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]">
          <div className="bg-white rounded-2xl p-8 sm:p-10 max-w-[420px] w-[90%] text-center shadow-2xl">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-2">배포 완료!</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-2">사이트가 공개되었습니다.</p>
            <a href={`/preview/${subdomain}`} target="_blank"
              className="inline-block mb-6 text-[13px] text-blue-500 no-underline font-semibold">
              {subdomain}.myplatform.com →
            </a>
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <p className="text-[13px] font-bold text-gray-900 mb-1">💳 카드를 등록하면 사이트가 계속 유지돼요</p>
              <p className="text-xs text-gray-400 m-0">월 30,000원 · 언제든지 해지 가능</p>
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => setShowDeployModal(false)}
                className="flex-1 py-2.5 bg-white text-gray-500 border border-gray-200 rounded-lg text-[13px] cursor-pointer">
                나중에
              </button>
              <button onClick={() => { setShowDeployModal(false); router.push(`/payment/card?site_id=${site.site_id}`) }}
                className="flex-[2] py-2.5 bg-gray-900 text-white border-none rounded-lg text-[13px] font-bold cursor-pointer">
                카드 등록하기 →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상단 툴바 */}
      <div className="h-[52px] bg-[#111827] flex items-center justify-between px-3 sm:px-5 border-b border-[#1f2937] shrink-0">
        <div className="flex items-center gap-2 sm:gap-3.5">
          <Link href={`/my/${subdomain}`} className="text-xs text-gray-500 no-underline">
            ← 포털
          </Link>
          <span className="text-[#1f2937] hidden sm:inline">|</span>
          <span className="text-[13px] font-bold text-white hidden sm:inline">에디터</span>
          <span className="text-xs text-gray-600 hidden sm:inline">{site.name}</span>
        </div>

        {/* 디바이스 전환 — 데스크톱만 */}
        <div className="hidden md:flex bg-[#1f2937] rounded-lg p-[3px] gap-0.5">
          {[{ id: 'desktop', icon: '🖥', label: 'PC' }, { id: 'mobile', icon: '📱', label: '모바일' }].map(d => (
            <button key={d.id} onClick={() => setPreviewDevice(d.id)} style={{
              padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600,
              background: previewDevice === d.id ? '#374151' : 'transparent',
              color: previewDevice === d.id ? 'white' : '#6b7280',
            }}>
              {d.icon} {d.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {saveMsg && (
            <span className={`text-xs ${saveMsg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
              {saveMsg}
            </span>
          )}
          <a href={`/preview/${subdomain}`} target="_blank" className="hidden sm:inline-block text-xs text-gray-400 no-underline px-3 py-1 border border-[#374151] rounded-md">
            실제 사이트 →
          </a>
          <button onClick={save} disabled={saving} className="px-3 sm:px-5 py-1.5 bg-[#374151] text-white border-none rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-70">
            {saving ? '저장 중...' : '저장'}
          </button>
          {site.deploy_status !== 'live' ? (
            <button onClick={handleDeploy} disabled={deploying} className="px-3 sm:px-5 py-1.5 bg-teal-600 text-white border-none rounded-lg text-[13px] font-bold cursor-pointer disabled:opacity-70">
              {deploying ? '배포 중...' : '🚀 배포'}
            </button>
          ) : (
            <span className="text-xs text-green-400 font-semibold">✅ 배포됨</span>
          )}
        </div>
      </div>

      {/* 모바일 뷰 전환 탭 — md 이하에서만 표시 */}
      <div className="flex md:hidden bg-[#111827] border-b border-[#1f2937]">
        {[
          { id: 'panel', label: '편집 패널' },
          { id: 'preview', label: '미리보기' },
        ].map(v => (
          <button key={v.id} onClick={() => setMobileView(v.id)}
            className={`flex-1 py-2.5 text-[13px] font-semibold border-none cursor-pointer ${
              mobileView === v.id
                ? 'bg-[#1e293b] text-blue-400 border-b-2 border-blue-400'
                : 'bg-transparent text-gray-500'
            }`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* 메인 영역 */}
      <div className="flex-1 flex overflow-hidden">

        {/* 섹션 탭 (아이콘) — 데스크톱만 */}
        <div className="hidden md:flex w-14 bg-[#111827] flex-col items-center pt-3 gap-1 border-r border-[#1f2937] shrink-0">
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => { setActiveSection(item.id); setMobileView('panel') }} title={item.label} style={{
              width: 40, height: 40, borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 18, background: activeSection === item.id ? '#3b82f6' : 'transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
            }}>
              <span>{item.icon}</span>
              <span style={{ fontSize: 8, color: activeSection === item.id ? 'white' : '#6b7280' }}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* 컨트롤 패널 */}
        <div className={`${mobileView === 'panel' ? 'flex' : 'hidden'} md:flex w-full md:w-[280px] bg-[#111827] md:border-r md:border-[#1f2937] overflow-auto shrink-0 flex-col`}>

          {/* 모바일 섹션 탭 (가로) */}
          <div className="flex md:hidden border-b border-[#1f2937]">
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => setActiveSection(item.id)}
                className={`flex-1 py-2 text-xs font-semibold border-none cursor-pointer ${
                  activeSection === item.id ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-500'
                }`}>
                {item.icon} {item.label}
              </button>
            ))}
          </div>

          <div style={{ padding: 20 }}>

            {/* 히어로 섹션 컨트롤 */}
            {activeSection === 'hero' && (
              <>
                <h3 style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 700, color: 'white' }}>히어로 섹션</h3>

                {/* 메인 제목 */}
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle('hero.title')}>메인 제목</label>
                  <input
                    value={content.hero.title}
                    onChange={e => updateHero('title', e.target.value)}
                    onFocus={() => setActiveField('hero.title')}
                    onBlur={() => setActiveField(null)}
                    style={inputStyle('hero.title')}
                  />
                </div>

                {/* 부제목 */}
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle('hero.subtitle')}>부제목 / 소개 문구</label>
                  <textarea
                    value={content.hero.subtitle}
                    onChange={e => updateHero('subtitle', e.target.value)}
                    onFocus={() => setActiveField('hero.subtitle')}
                    onBlur={() => setActiveField(null)}
                    rows={3}
                    style={{ ...inputStyle('hero.subtitle'), resize: 'vertical' }}
                  />
                </div>

                {/* 버튼 텍스트 */}
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle('hero.ctaText')}>버튼 텍스트</label>
                  <input
                    value={content.hero.ctaText}
                    onChange={e => updateHero('ctaText', e.target.value)}
                    onFocus={() => setActiveField('hero.ctaText')}
                    onBlur={() => setActiveField(null)}
                    style={inputStyle('hero.ctaText')}
                  />
                </div>

                {/* 배경 색상 */}
                <div style={{ marginBottom: 8 }}>
                  <label style={labelStyle('hero.bgColor')}>배경 색상</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                    <input
                      type="color"
                      value={content.hero.bgColor}
                      onChange={e => updateHero('bgColor', e.target.value)}
                      onFocus={() => setActiveField('hero.bgColor')}
                      onBlur={() => setActiveField(null)}
                      style={{ width: 38, height: 34, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'none', padding: 0 }}
                    />
                    <input
                      value={content.hero.bgColor}
                      onChange={e => updateHero('bgColor', e.target.value)}
                      onFocus={() => setActiveField('hero.bgColor')}
                      onBlur={() => setActiveField(null)}
                      style={{ ...inputStyle('hero.bgColor'), flex: 1 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 7 }}>
                    {PRESET_COLORS.map(c => (
                      <button key={c} onClick={() => updateHero('bgColor', c)} style={{
                        width: 26, height: 26, borderRadius: 5, background: c, cursor: 'pointer',
                        border: content.hero.bgColor === c ? '2px solid #3b82f6' : '2px solid transparent',
                        padding: 0,
                      }} title={c} />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* 연락처 컨트롤 */}
            {activeSection === 'contact' && (
              <>
                <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: 'white' }}>연락처 정보</h3>
                <p style={{ margin: '0 0 20px', fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                  사이트에 표시될 연락처 정보를 수정하세요.
                </p>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle('contact.address')}>주소</label>
                  <input
                    value={contact.address}
                    onChange={e => setContact(prev => ({ ...prev, address: e.target.value }))}
                    onFocus={() => setActiveField('contact.address')}
                    onBlur={() => setActiveField(null)}
                    placeholder="서울시 강남구..."
                    style={inputStyle('contact.address')}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle('contact.phone')}>전화번호</label>
                  <input
                    value={contact.phone}
                    onChange={e => setContact(prev => ({ ...prev, phone: e.target.value }))}
                    onFocus={() => setActiveField('contact.phone')}
                    onBlur={() => setActiveField(null)}
                    placeholder="02-0000-0000"
                    style={inputStyle('contact.phone')}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle('contact.email')}>이메일</label>
                  <input
                    value={contact.email}
                    onChange={e => setContact(prev => ({ ...prev, email: e.target.value }))}
                    onFocus={() => setActiveField('contact.email')}
                    onBlur={() => setActiveField(null)}
                    placeholder="info@mybiz.com"
                    style={inputStyle('contact.email')}
                  />
                </div>
              </>
            )}

            {/* 영업시간 컨트롤 */}
            {activeSection === 'hours' && (
              <>
                <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: 'white' }}>영업시간</h3>
                <p style={{ margin: '0 0 20px', fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                  요일별 영업시간을 입력하세요. 비워두면 표시되지 않아요.
                </p>

                {[
                  { key: 'mon', label: '월요일' },
                  { key: 'tue', label: '화요일' },
                  { key: 'wed', label: '수요일' },
                  { key: 'thu', label: '목요일' },
                  { key: 'fri', label: '금요일' },
                  { key: 'sat', label: '토요일' },
                  { key: 'sun', label: '일요일' },
                ].map(({ key, label }) => (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <label style={labelStyle(`hours.${key}`)}>{label}</label>
                    <input
                      value={content.hours?.[key] || ''}
                      onChange={e => setContent(prev => ({
                        ...prev,
                        hours: { ...prev.hours, [key]: e.target.value }
                      }))}
                      onFocus={() => setActiveField(`hours.${key}`)}
                      onBlur={() => setActiveField(null)}
                      placeholder="09:00 - 22:00 또는 휴무"
                      style={inputStyle(`hours.${key}`)}
                    />
                  </div>
                ))}
              </>
            )}

            {/* SNS 링크 컨트롤 */}
            {activeSection === 'sns' && (
              <>
                <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: 'white' }}>SNS 링크</h3>
                <p style={{ margin: '0 0 20px', fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                  SNS 링크를 입력하면 사이트에 표시돼요.
                </p>

                {[
                  { key: 'instagram', label: 'Instagram', icon: '📸', ph: 'https://instagram.com/...' },
                  { key: 'kakao', label: 'KakaoTalk', icon: '💬', ph: 'https://pf.kakao.com/...' },
                  { key: 'naver', label: 'Naver Blog', icon: '📝', ph: 'https://blog.naver.com/...' },
                  { key: 'youtube', label: 'YouTube', icon: '🎬', ph: 'https://youtube.com/...' },
                ].map(({ key, label, icon, ph }) => (
                  <div key={key} style={{ marginBottom: 14 }}>
                    <label style={labelStyle(`sns.${key}`)}>{icon} {label}</label>
                    <input
                      value={content.sns?.[key] || ''}
                      onChange={e => setContent(prev => ({
                        ...prev,
                        sns: { ...prev.sns, [key]: e.target.value }
                      }))}
                      onFocus={() => setActiveField(`sns.${key}`)}
                      onBlur={() => setActiveField(null)}
                      placeholder={ph}
                      style={inputStyle(`sns.${key}`)}
                    />
                  </div>
                ))}
              </>
            )}

            {/* 섹션 표시 컨트롤 */}
            {activeSection === 'sections' && (
              <>
                <h3 style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 700, color: 'white' }}>섹션 표시 설정</h3>
                <p style={{ margin: '0 0 20px', fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                  페이지에 표시할 섹션을 켜고 끌 수 있어요.
                </p>

                {[
                  { key: 'showInfo',    label: '연락처 정보 카드', desc: '주소 · 전화 · 이메일 카드' },
                  { key: 'showBoard',   label: '최근 게시물',     desc: '게시판 최근 3개 표시' },
                  { key: 'showHours',   label: '영업시간',        desc: '요일별 영업시간 표시' },
                  { key: 'showGallery', label: '갤러리',          desc: '이미지 갤러리 (최대 4장)' },
                  { key: 'showSns',     label: 'SNS 링크',       desc: '인스타, 카카오, 블로그 등' },
                ].map(({ key, label, desc }) => (
                  <div key={key} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px 0', borderBottom: '1px solid #1f2937',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, color: 'white', fontWeight: 500, marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 11, color: '#4b5563' }}>{desc}</div>
                    </div>
                    <button onClick={() => updateSections(key, !content.sections[key])} style={{
                      width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: content.sections[key] ? '#3b82f6' : '#374151',
                      position: 'relative', flexShrink: 0,
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', background: 'white',
                        position: 'absolute', top: 3,
                        left: content.sections[key] ? 21 : 3,
                        transition: 'left 0.15s',
                      }} />
                    </button>
                  </div>
                ))}

                <div style={{ marginTop: 24, padding: 14, background: '#1f2937', borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.7 }}>
                    💡 연락처 정보(주소, 전화, 이메일)는<br />
                    <Link href={`/my/${subdomain}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>포털 → 기본 정보 수정</Link>에서 변경할 수 있어요.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 미리보기 영역 */}
        <div className={`${mobileView === 'preview' ? 'flex' : 'hidden'} md:flex flex-1 overflow-auto bg-[#0f172a] flex-col items-center p-4 md:p-6 pb-10`}>
          <div className="hidden md:block text-[11px] text-[#374151] mb-3.5 tracking-wider">
            PREVIEW — {previewDevice === 'mobile' ? '모바일 (390px)' : 'PC'}
          </div>
          <div className="w-full rounded-xl overflow-hidden shadow-2xl transition-all duration-200" style={{
            maxWidth: previewDevice === 'mobile' ? 390 : 960,
            background: '#fafaf9',
          }}>
            <SitePreview site={site} content={content} contact={contact} activeField={activeField} onFieldClick={handlePreviewFieldClick} />
          </div>
        </div>
      </div>
    </div>
  )
}
