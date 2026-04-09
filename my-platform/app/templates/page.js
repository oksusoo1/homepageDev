'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// 카테고리 메타 정보
const CATEGORY_META = {
  all:        { label: '전체',     icon: '🗂' },
  cafe:       { label: '카페',     icon: '☕' },
  restaurant: { label: '식당',     icon: '🍽' },
  salon:      { label: '미용실',   icon: '💇' },
  clinic:     { label: '병원/의원', icon: '🏥' },
  academy:    { label: '학원',     icon: '📚' },
  general:    { label: '일반 소개', icon: '🏢' },
}

// 카테고리별 썸네일 색상 (thumbnail_url 없을 때)
const CATEGORY_COLOR = {
  cafe:       { bg: '#fef3c7', accent: '#d97706', text: '#92400e' },
  restaurant: { bg: '#fce7f3', accent: '#db2777', text: '#831843' },
  salon:      { bg: '#ede9fe', accent: '#7c3aed', text: '#4c1d95' },
  clinic:     { bg: '#e0f2fe', accent: '#0284c7', text: '#0c4a6e' },
  academy:    { bg: '#dcfce7', accent: '#16a34a', text: '#14532d' },
  general:    { bg: '#f1f5f9', accent: '#475569', text: '#1e293b' },
}

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState([])
  const [activeTab, setActiveTab] = useState('all')
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    checkAuthAndFetch()
  }, [])

  async function checkAuthAndFetch() {
    // 로그인 체크
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setAuthChecked(true)

    // 템플릿 목록 조회
    const { data } = await supabase
      .from('templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    setTemplates(data || [])
    setLoading(false)
  }

  // 탭에 따라 필터링
  const filtered = activeTab === 'all'
    ? templates
    : templates.filter(t => t.category === activeTab)

  // 카테고리 탭 목록 (templates에 있는 카테고리만)
  const availableCategories = ['all', ...new Set(templates.map(t => t.category))]

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8f7f4', fontFamily: "'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      <div style={{ color: '#9ca3af', fontSize: 14 }}>로딩 중...</div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f7f4',
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>

      {/* 헤더 */}
      <div style={{
        background: 'white', borderBottom: '1px solid #e5e7eb',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/my" style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'none' }}>
            ← 내 사이트
          </Link>
          <span style={{ color: '#e5e7eb' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7, background: '#111827',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: 'white', fontWeight: 800,
            }}>M</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>템플릿 선택</span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          Step 1/2 — 템플릿 선택
        </div>
      </div>

      {/* 타이틀 */}
      <div style={{ textAlign: 'center', padding: '52px 20px 36px' }}>
        <h1 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>
          어떤 업종인가요?
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>
          업종에 맞는 템플릿을 선택하면 기본 구성이 자동으로 설정돼요
        </p>
      </div>

      {/* 카테고리 탭 */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 8,
        padding: '0 20px 32px', flexWrap: 'wrap',
      }}>
        {availableCategories.map(cat => {
          const meta = CATEGORY_META[cat] || { label: cat, icon: '📁' }
          const isActive = activeTab === cat
          return (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 30, cursor: 'pointer',
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                background: isActive ? '#111827' : 'white',
                color: isActive ? 'white' : '#6b7280',
                border: isActive ? '1px solid #111827' : '1px solid #e5e7eb',
                transition: 'all 0.15s',
              }}>
              <span style={{ fontSize: 14 }}>{meta.icon}</span>
              {meta.label}
            </button>
          )
        })}
      </div>

      {/* 템플릿 그리드 */}
      <div style={{
        maxWidth: 900, margin: '0 auto', padding: '0 20px 80px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20,
      }}>
        {filtered.map(template => {
          const color = CATEGORY_COLOR[template.category] || CATEGORY_COLOR.general
          const meta = CATEGORY_META[template.category] || { label: template.category, icon: '📁' }

          return (
            <div
              key={template.template_id}
              style={{
                background: 'white', borderRadius: 14,
                border: '1px solid #e5e7eb', overflow: 'hidden',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#111827'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#e5e7eb'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
              onClick={() => router.push(`/setup?template=${template.template_id}&category=${template.category}`)}
            >
              {/* 썸네일 */}
              <div style={{
                height: 160, background: color.bg,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10,
                position: 'relative',
              }}>
                {template.thumbnail_url ? (
                  <img src={template.thumbnail_url} alt={template.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <>
                    {/* 가상 사이트 UI 스케치 */}
                    <div style={{ fontSize: 36 }}>{meta.icon}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: 140 }}>
                      <div style={{ height: 7, background: color.accent, borderRadius: 4, opacity: 0.6 }} />
                      <div style={{ height: 5, background: color.accent, borderRadius: 4, opacity: 0.3, width: '70%' }} />
                      <div style={{ height: 5, background: color.accent, borderRadius: 4, opacity: 0.2, width: '90%' }} />
                    </div>
                  </>
                )}
                {/* 카테고리 뱃지 */}
                <div style={{
                  position: 'absolute', top: 12, left: 12,
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  background: color.accent, color: 'white',
                }}>
                  {meta.label}
                </div>
              </div>

              {/* 카드 하단 */}
              <div style={{ padding: '16px 18px 18px' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                  {template.name}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
                  {meta.label} 업종에 최적화된 기본 구성
                </div>
                <button style={{
                  width: '100%', padding: '10px', borderRadius: 8,
                  background: '#111827', color: 'white',
                  border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>
                  이 템플릿으로 시작 →
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
