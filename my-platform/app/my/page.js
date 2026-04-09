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

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: cust } = await supabase
      .from('customers').select('*').eq('auth_id', user.id).single()
    if (!cust) { router.push('/login'); return }
    setCustomer(cust)

    const { data: siteList } = await supabase
      .from('sites')
      .select('*, subscriptions(status, amount, next_billing_date)')
      .eq('customer_id', cust.customer_id)
      .order('created_at', { ascending: false })
    setSites(siteList || [])
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
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
              또는 본사에 제작을 맡길 수 있어요 —{' '}
              <a href="mailto:contact@myplatform.com" style={{ color: '#9ca3af', textDecoration: 'underline' }}>
                문의하기
              </a>
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
