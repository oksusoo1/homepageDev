'use client'
import { useState, useEffect } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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

  useEffect(() => { init() }, [subdomain])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: cust } = await supabase
      .from('customers').select('*').eq('auth_id', user.id).single()
    if (!cust) { router.push('/login'); return }

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
        showInfo:  saved.sections?.showInfo  ?? true,
        showBoard: saved.sections?.showBoard ?? true,
      },
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

  async function deploySite() {
    setDeploying(true)
    const now = new Date()
    const trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    const nextBilling = new Date(trialEnds)
    nextBilling.setMonth(nextBilling.getMonth() + 1)
    nextBilling.setDate(1)

    const { error } = await supabase.from('sites')
      .update({
        status: 'published', deploy_status: 'live',
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnds.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('site_id', site.site_id)

    if (!error) {
      const { data: existingSub } = await supabase
        .from('subscriptions').select('subscription_id').eq('site_id', site.site_id).maybeSingle()
      if (!existingSub) {
        await supabase.from('subscriptions').insert({
          customer_id: site.customer_id,
          site_id: site.site_id,
          amount: 30000, billing_day: 1,
          payment_method: 'manual', status: 'trial',
          next_billing_date: nextBilling.toISOString().split('T')[0],
        })
      } else {
        await supabase.from('subscriptions')
          .update({ status: 'trial', next_billing_date: nextBilling.toISOString().split('T')[0] })
          .eq('site_id', site.site_id)
      }
      setSite(prev => ({ ...prev, status: 'published', deploy_status: 'live' }))
      setShowDeployModal(true)
    }
    setDeploying(false)
  }

  // 미리보기 요소 클릭 → 해당 필드 활성화 + 왼쪽 탭 자동 전환
  function handlePreviewFieldClick(field) {
    setActiveField(field)
    if (field.startsWith('hero'))    setActiveSection('hero')
    if (field.startsWith('contact')) setActiveSection('contact')
  }

  if (loading || !content) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111827' }}>
      <div style={{ color: '#9ca3af', fontSize: 14 }}>로딩 중...</div>
    </div>
  )

  const NAV_ITEMS = [
    { id: 'hero',    icon: '🏠', label: '히어로' },
    { id: 'contact', icon: '📍', label: '연락처' },
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a', fontFamily: "'Pretendard', -apple-system, sans-serif" }}>

      {/* 배포 완료 모달 */}
      {showDeployModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: '40px 36px', maxWidth: 420, width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
            <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: '#111827' }}>배포 완료!</h2>
            <p style={{ margin: '0 0 8px', fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>사이트가 공개되었습니다.</p>
            <a href={`/preview/${subdomain}`} target="_blank"
              style={{ display: 'inline-block', marginBottom: 24, fontSize: 13, color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
              {subdomain}.myplatform.com →
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

      {/* 상단 툴바 */}
      <div style={{
        height: 52, background: '#111827',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', borderBottom: '1px solid #1f2937', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href={`/my/${subdomain}`} style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none' }}>
            ← 포털
          </Link>
          <span style={{ color: '#1f2937' }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>에디터</span>
          <span style={{ fontSize: 12, color: '#4b5563' }}>{site.name}</span>
        </div>

        {/* 디바이스 전환 */}
        <div style={{ display: 'flex', background: '#1f2937', borderRadius: 8, padding: 3, gap: 2 }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {saveMsg && (
            <span style={{ fontSize: 12, color: saveMsg.startsWith('✅') ? '#4ade80' : '#f87171' }}>
              {saveMsg}
            </span>
          )}
          <a href={`/preview/${subdomain}`} target="_blank" style={{
            fontSize: 12, color: '#9ca3af', textDecoration: 'none',
            padding: '5px 12px', border: '1px solid #374151', borderRadius: 6,
          }}>
            실제 사이트 →
          </a>
          <button onClick={save} disabled={saving} style={{
            padding: '7px 20px', background: '#374151', color: 'white',
            border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600,
            cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
          }}>
            {saving ? '저장 중...' : '저장하기'}
          </button>
          {site.deploy_status !== 'live' ? (
            <button onClick={deploySite} disabled={deploying} style={{
              padding: '7px 20px', background: '#0d9488', color: 'white',
              border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700,
              cursor: deploying ? 'default' : 'pointer', opacity: deploying ? 0.7 : 1,
            }}>
              {deploying ? '배포 중...' : '🚀 배포하기'}
            </button>
          ) : (
            <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>✅ 배포됨</span>
          )}
        </div>
      </div>

      {/* 메인 영역 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* 섹션 탭 (아이콘) */}
        <div style={{
          width: 56, background: '#111827',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingTop: 12, gap: 4,
          borderRight: '1px solid #1f2937', flexShrink: 0,
        }}>
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setActiveSection(item.id)} title={item.label} style={{
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
        <div style={{
          width: 280, background: '#111827',
          borderRight: '1px solid #1f2937',
          overflow: 'auto', flexShrink: 0,
        }}>
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

            {/* 섹션 표시 컨트롤 */}
            {activeSection === 'sections' && (
              <>
                <h3 style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 700, color: 'white' }}>섹션 표시 설정</h3>
                <p style={{ margin: '0 0 20px', fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                  페이지에 표시할 섹션을 켜고 끌 수 있어요.
                </p>

                {[
                  { key: 'showInfo', label: '연락처 정보 카드', desc: '주소 · 전화 · 이메일 카드' },
                  { key: 'showBoard', label: '최근 게시물', desc: '게시판 최근 3개 표시' },
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
        <div style={{
          flex: 1, overflow: 'auto', background: '#0f172a',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '24px 24px 40px',
        }}>
          <div style={{ fontSize: 11, color: '#374151', marginBottom: 14, letterSpacing: 1 }}>
            PREVIEW — {previewDevice === 'mobile' ? '모바일 (390px)' : 'PC'}
          </div>
          <div style={{
            width: '100%',
            maxWidth: previewDevice === 'mobile' ? 390 : 960,
            background: '#fafaf9',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
            transition: 'max-width 0.2s',
          }}>
            <SitePreview site={site} content={content} contact={contact} activeField={activeField} onFieldClick={handlePreviewFieldClick} />
          </div>
        </div>
      </div>
    </div>
  )
}
