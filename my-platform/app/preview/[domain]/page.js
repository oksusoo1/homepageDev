import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

async function getSite(domain) {
  const subdomain = domain.split('.')[0]

  // 커스텀 도메인 먼저 조회 (cancelled만 제외)
  let { data } = await supabase
    .from('sites')
    .select('*')
    .eq('domain', domain)
    .neq('status', 'cancelled')
    .single()
  if (!data) {
    // 서브도메인으로 조회
    ;({ data } = await supabase
      .from('sites')
      .select('*')
      .eq('subdomain', subdomain)
      .neq('status', 'cancelled')
      .single())
  }
  if (!data) return null

  // cancels_at 만료 체크 — 방문 시 자동 처리
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('subscription_id, cancels_at, status')
    .eq('site_id', data.site_id)
    .maybeSingle()

  if (sub?.cancels_at && new Date(sub.cancels_at) <= new Date() && sub.status !== 'cancelled') {
    await supabase.from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('subscription_id', sub.subscription_id)
    await supabase.from('sites')
      .update({ status: 'suspended', updated_at: new Date().toISOString() })
      .eq('site_id', data.site_id)
    return { ...data, status: 'suspended' }
  }

  return data
}

async function getRecentPosts(siteId) {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(3)
  return data || []
}

export default async function CustomerSitePage({ params }) {
  const { domain } = await params
  const site = await getSite(domain)
  if (!site) notFound()

  // 정지된 사이트 안내 페이지
  if (site.status === 'suspended') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center font-sans">
        <div className="text-center px-5 py-10">
          <div className="text-6xl mb-5">🔒</div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-3">사이트 준비 중입니다</h1>
          <p className="text-[15px] text-gray-500 leading-relaxed mb-2">
            현재 이 사이트는 일시적으로 운영이 중단되었습니다.<br />
            사이트 운영자에게 문의해 주세요.
          </p>
          <p className="text-xs text-gray-400 mt-6">Powered by MyPlatform</p>
        </div>
      </div>
    )
  }

  const posts = await getRecentPosts(site.site_id)

  const c = site.content || {}
  const hero = { title: '', subtitle: '', ctaText: '문의하기', bgColor: '#1c1917', ...c.hero }
  const sections = { showInfo: true, showBoard: true, showHours: true, showGallery: true, showSns: true, ...c.sections }
  const hours = c.hours || null
  const gallery = c.gallery || []
  const sns = c.sns || {}

  const heroBg = hero.bgColor || '#1c1917'
  const heroTitle = hero.title || site.name
  const heroSubtitle = hero.subtitle || site.description
  const ctaText = hero.ctaText || '문의하기'

  const hasInfo = site.address || site.phone || site.email
  const hasHours = hours && Object.keys(hours).length > 0
  const hasGallery = gallery.length > 0
  const hasSns = Object.values(sns).some(v => v)

  const DAY_LABELS = {
    mon: '월요일', tue: '화요일', wed: '수요일', thu: '목요일',
    fri: '금요일', sat: '토요일', sun: '일요일',
  }

  const SNS_ICONS = {
    instagram: { label: 'Instagram', icon: '📸' },
    kakao: { label: 'KakaoTalk', icon: '💬' },
    naver: { label: 'Naver Blog', icon: '📝' },
    youtube: { label: 'YouTube', icon: '🎬' },
  }

  return (
    <div className="min-h-screen bg-[#fafaf9] font-serif">

      {/* 헤더 */}
      <header
        className="flex items-center justify-between px-5 sm:px-10 h-16"
        style={{ background: heroBg }}
      >
        <h1 className="text-lg sm:text-xl font-semibold text-white tracking-tight m-0">
          {site.name}
        </h1>
        <nav className="flex gap-4 sm:gap-7">
          {[
            { label: '홈', href: `/preview/${domain}` },
            { label: '게시판', href: `/preview/${domain}/board` },
            { label: '문의', href: `/preview/${domain}/contact` },
          ].map(({ label, href }) => (
            <Link key={label} href={href}
              className="text-stone-300 no-underline text-xs sm:text-sm">
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {/* 히어로 */}
      <section
        className="text-white py-16 sm:py-24 md:py-28 px-5 sm:px-10 text-center"
        style={{ background: `linear-gradient(135deg, ${heroBg} 0%, #292524 60%, #44403c 100%)` }}
      >
        <div className="max-w-[640px] mx-auto">
          <p className="text-[11px] tracking-[4px] text-stone-400 mb-5 uppercase">
            Welcome
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-5 sm:mb-6">
            {heroTitle}
          </h2>
          {heroSubtitle && (
            <p className="text-sm sm:text-base text-stone-300 leading-relaxed mb-8 sm:mb-9">
              {heroSubtitle}
            </p>
          )}
          <Link href={`/preview/${domain}/contact`}
            className="inline-block px-7 sm:px-8 py-3 sm:py-3.5 bg-white text-stone-900 rounded-lg no-underline text-sm font-semibold">
            {ctaText}
          </Link>
        </div>
      </section>

      {/* 정보 카드 */}
      {sections.showInfo && hasInfo && (
        <section className="max-w-[800px] mx-auto mt-12 sm:mt-16 px-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            {[
              { icon: '📍', label: '주소', value: site.address },
              { icon: '📞', label: '전화', value: site.phone },
              { icon: '✉️', label: '이메일', value: site.email },
            ].map(({ icon, label, value }) => value && (
              <div key={label}
                className="bg-white rounded-xl p-6 sm:p-7 text-center border border-stone-200 shadow-sm">
                <div className="text-2xl sm:text-3xl mb-3">{icon}</div>
                <div className="text-[10px] sm:text-[11px] text-stone-400 tracking-widest mb-2 uppercase">
                  {label}
                </div>
                <div className="text-sm text-stone-900 font-medium">{value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 영업시간 */}
      {sections.showHours && hasHours && (
        <section className="max-w-[800px] mx-auto mt-12 sm:mt-16 px-5">
          <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-5 sm:mb-6 text-center">
            영업시간
          </h3>
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden max-w-[480px] mx-auto">
            {Object.entries(DAY_LABELS).map(([key, label], i, arr) => {
              const value = hours[key]
              if (!value) return null
              const isToday = new Date().getDay() === ([0, 1, 2, 3, 4, 5, 6].indexOf(
                ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(key)
              ))
              return (
                <div key={key}
                  className={`flex justify-between items-center px-5 sm:px-6 py-3 sm:py-3.5 text-sm ${
                    i < arr.length - 1 ? 'border-b border-stone-100' : ''
                  } ${isToday ? 'bg-stone-50 font-semibold' : ''}`}>
                  <span className="text-stone-500">{label}</span>
                  <span className={`${value === '휴무' ? 'text-red-500' : 'text-stone-900'}`}>
                    {value}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 갤러리 */}
      {sections.showGallery && hasGallery && (
        <section className="max-w-[800px] mx-auto mt-12 sm:mt-16 px-5">
          <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-5 sm:mb-6 text-center">
            갤러리
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {gallery.slice(0, 4).map((url, i) => (
              <div key={i}
                className="aspect-square rounded-xl overflow-hidden bg-stone-200 border border-stone-200">
                <img src={url} alt={`갤러리 ${i + 1}`}
                  className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 최근 게시글 */}
      {sections.showBoard && posts.length > 0 && (
        <section className="max-w-[800px] mx-auto mt-12 sm:mt-16 mb-16 sm:mb-20 px-5">
          <div className="flex justify-between items-center mb-5 sm:mb-6">
            <h3 className="text-xl sm:text-2xl font-bold text-stone-900 m-0">최근 공지</h3>
            <Link href={`/preview/${domain}/board`}
              className="text-[13px] text-stone-500 no-underline">
              전체보기 →
            </Link>
          </div>
          <div className="flex flex-col">
            {posts.map((post, i) => (
              <Link key={post.post_id} href={`/preview/${domain}/board/${post.post_id}`}
                className={`flex justify-between items-center px-5 sm:px-6 py-4 sm:py-5 bg-white no-underline text-stone-900 border border-stone-200 ${
                  i === 0 ? 'rounded-t-xl' : ''
                } ${i === posts.length - 1 ? 'rounded-b-xl' : ''} ${
                  i > 0 ? '-mt-px' : ''
                }`}>
                <div>
                  <div className="text-sm sm:text-[15px] font-medium mb-1">{post.title}</div>
                  <div className="text-xs text-stone-400">{post.author}</div>
                </div>
                <div className="text-xs text-stone-400 shrink-0 ml-4">
                  {new Date(post.created_at).toLocaleDateString('ko-KR')}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* SNS 링크 */}
      {sections.showSns && hasSns && (
        <section className="max-w-[800px] mx-auto mb-16 sm:mb-20 px-5 text-center">
          <h3 className="text-xl sm:text-2xl font-bold text-stone-900 mb-5 sm:mb-6">
            SNS
          </h3>
          <div className="flex justify-center gap-4 sm:gap-5 flex-wrap">
            {Object.entries(SNS_ICONS).map(([key, { label, icon }]) => {
              const url = sns[key]
              if (!url) return null
              return (
                <a key={key} href={url} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 px-4 py-3 bg-white rounded-xl border border-stone-200 no-underline shadow-sm hover:shadow-md transition-shadow min-w-[80px]">
                  <span className="text-2xl">{icon}</span>
                  <span className="text-xs text-stone-500 font-medium">{label}</span>
                </a>
              )
            })}
          </div>
        </section>
      )}

      {/* 푸터 */}
      <footer
        className="text-center py-8 px-5 text-xs"
        style={{ background: heroBg, color: '#78716c' }}
      >
        <p className="m-0 mb-1.5">&copy; {new Date().getFullYear()} {site.name}</p>
        <p className="m-0 text-[11px]">Powered by MyPlatform</p>
      </footer>
    </div>
  )
}
