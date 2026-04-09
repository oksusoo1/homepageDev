import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">

      {/* 헤더 */}
      <header className="flex items-center justify-between px-6 md:px-12 h-16 border-b border-[#1f1f1f]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[15px] text-[#0a0a0a] font-black">
            M
          </div>
          <span className="text-[15px] font-bold tracking-tight">MyPlatform</span>
        </div>
        <div className="flex gap-3 items-center">
          <Link href="/login" className="text-[13px] text-gray-400 no-underline px-4 py-1.5 hidden sm:block">
            로그인
          </Link>
          <Link href="/login?tab=signup" className="text-[13px] text-[#0a0a0a] bg-white no-underline px-4 py-1.5 rounded-lg font-bold">
            무료 시작하기
          </Link>
        </div>
      </header>

      {/* 히어로 */}
      <section className="max-w-[900px] mx-auto px-6 md:px-12 pt-20 md:pt-[120px] pb-20 md:pb-[100px] text-center">
        <div className="inline-block text-[11px] font-bold tracking-[3px] text-gray-500 bg-[#161616] border border-[#2a2a2a] px-3.5 py-1 rounded-full mb-9 uppercase">
          소상공인을 위한 홈페이지 플랫폼
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.15] mb-7 tracking-tight">
          홈페이지, 이제<br />
          <span className="text-gray-400">월 3만원</span>으로
        </h1>

        <p className="text-base md:text-[17px] text-gray-500 leading-relaxed mb-12 max-w-[520px] mx-auto">
          식당, 카페, 미용실, 학원, 병원 —<br />
          쇼핑몰 없이 소개 페이지만 필요한 소상공인을 위한 서비스예요.
        </p>

        <div className="flex gap-3.5 justify-center flex-wrap">
          <Link href="/login?tab=signup" className="text-[15px] font-bold bg-white text-[#0a0a0a] no-underline px-9 py-4 rounded-xl">
            지금 바로 시작하기 →
          </Link>
          <Link href="/preview/hongcafe" className="text-[15px] font-semibold bg-transparent text-gray-400 no-underline px-9 py-4 rounded-xl border border-[#2a2a2a]">
            데모 사이트 보기
          </Link>
        </div>
      </section>

      {/* 특징 3가지 */}
      <section className="max-w-[900px] mx-auto px-6 md:px-12 pb-20 md:pb-[120px] grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { icon: '⚡', title: '빠른 제작', desc: '템플릿 선택 후 기본 정보만 입력하면 바로 완성. 복잡한 설정 없이 오늘 바로 오픈.' },
          { icon: '💳', title: '월 3만원 구독', desc: '초기 비용 없이 월 구독료만. 도메인 연결, 게시판, 문의 폼 모두 포함.' },
          { icon: '🛠️', title: '본사 대리 제작', desc: '직접 만들기 어려우면 본사에 맡기세요. 제작 후 월 구독료만 납부하면 돼요.' },
        ].map(({ icon, title, desc }) => (
          <div key={title} className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-7 md:p-8">
            <div className="text-[28px] mb-4">{icon}</div>
            <h3 className="text-base font-bold text-white mb-3">{title}</h3>
            <p className="text-[13px] text-gray-500 leading-relaxed m-0">{desc}</p>
          </div>
        ))}
      </section>

      {/* 요금 안내 */}
      <section className="max-w-[900px] mx-auto px-6 md:px-12 pb-20 md:pb-[120px]">
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl md:rounded-3xl p-10 md:p-14 text-center">
          <p className="text-[11px] tracking-[3px] text-gray-500 uppercase mb-3 m-0">요금 안내</p>
          <h2 className="text-3xl md:text-[42px] font-extrabold tracking-tight mb-2">
            월 <span className="text-white">30,000원</span>
          </h2>
          <p className="text-sm text-gray-500 mb-10 m-0">부가세 포함 · 언제든 해지 가능</p>

          <div className="flex justify-center gap-x-8 gap-y-3 flex-wrap mb-12">
            {[
              '서브도메인 무료 제공',
              '게시판 기능 포함',
              '방문자 문의 폼 포함',
              '모바일 반응형',
              '수정 요청 월 3회',
              '커스텀 도메인 연결 가능',
            ].map(item => (
              <div key={item} className="flex items-center gap-2 text-[13px] text-gray-400">
                <span className="text-green-500 font-bold">✓</span> {item}
              </div>
            ))}
          </div>

          <Link href="/login?tab=signup" className="text-[15px] font-bold bg-white text-[#0a0a0a] no-underline px-12 py-4 rounded-xl inline-block">
            무료로 시작하기
          </Link>
          <p className="text-xs text-gray-600 mt-4 m-0">
            배포 전까지는 무료 · 카드 등록 후 과금 시작
          </p>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-[#1a1a1a] px-6 md:px-12 py-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-600">
        <span>© 2025 MyPlatform</span>
        <Link href="/login" className="text-gray-600 no-underline">관리자 로그인</Link>
      </footer>

    </div>
  )
}
