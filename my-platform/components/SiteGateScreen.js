import Link from 'next/link'
import { sitePublicPath } from '@/lib/site-paths'

/** 서버에서 막힌 방문자에게만 보여주는 화면. 사이트 본문은 넣지 않는다. */
export default function SiteGateScreen({ visibility, siteCode, cancelled = false }) {
  if (visibility === 'hidden') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center font-sans relative">
        <div className="text-center px-5 py-10">
          <div className="text-6xl mb-5">{cancelled ? '⏹' : '🔒'}</div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-3">
            {cancelled ? '서비스가 종료되었습니다' : '사이트 준비 중입니다'}
          </h1>
          <p className="text-[15px] text-gray-500 leading-relaxed mb-2">
            {cancelled
              ? <>이 사이트의 서비스가 해지되었습니다.<br />사이트 운영자에게 문의해 주세요.</>
              : <>현재 이 사이트는 일시적으로 운영이 중단되었습니다.<br />사이트 운영자에게 문의해 주세요.</>}
          </p>
          <p className="text-xs text-gray-400 mt-6">Powered by MyPlatform</p>
        </div>
      </div>
    )
  }

  const isProducer = visibility === 'producer'
  return (
    <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center font-sans px-5" data-testid="site-gate-blocked">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">{isProducer ? '🛠' : '🔍'}</div>
        <h1 className="text-xl font-bold text-stone-900 mb-2">
          {isProducer ? '제작 중입니다' : '부분 공개'}
        </h1>
        <p className="text-sm text-stone-500 leading-relaxed mb-6">
          {isProducer
            ? <>제작하는 사람만 볼 수 있습니다.<br />일반 공개 전입니다.</>
            : <>본사 또는 사이트 소유자만 볼 수 있습니다.</>}
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(sitePublicPath(siteCode))}`}
          className="inline-block px-6 py-3 bg-stone-900 text-white rounded-lg no-underline text-sm font-semibold"
        >
          로그인
        </Link>
      </div>
    </div>
  )
}
