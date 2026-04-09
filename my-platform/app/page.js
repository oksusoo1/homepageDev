import Link from 'next/link'

export default function LandingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
      color: 'white',
    }}>

      {/* 헤더 */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', height: 64,
        borderBottom: '1px solid #1f1f1f',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, color: '#0a0a0a', fontWeight: 900,
          }}>M</div>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>MyPlatform</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/login" style={{
            fontSize: 13, color: '#888', textDecoration: 'none',
            padding: '7px 16px',
          }}>
            로그인
          </Link>
          <Link href="/login?tab=signup" style={{
            fontSize: 13, color: '#0a0a0a', background: 'white',
            textDecoration: 'none', padding: '7px 18px',
            borderRadius: 7, fontWeight: 700,
          }}>
            무료 시작하기
          </Link>
        </div>
      </header>

      {/* 히어로 */}
      <section style={{
        maxWidth: 900, margin: '0 auto',
        padding: '120px 48px 100px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block',
          fontSize: 11, fontWeight: 700, letterSpacing: 3,
          color: '#555', background: '#161616',
          border: '1px solid #2a2a2a',
          padding: '5px 14px', borderRadius: 20,
          marginBottom: 36, textTransform: 'uppercase',
        }}>
          소상공인을 위한 홈페이지 플랫폼
        </div>

        <h1 style={{
          fontSize: 62, fontWeight: 800, lineHeight: 1.15,
          margin: '0 0 28px',
          letterSpacing: '-2px',
          color: 'white',
        }}>
          홈페이지, 이제<br />
          <span style={{ color: '#888' }}>월 3만원</span>으로
        </h1>

        <p style={{
          fontSize: 17, color: '#666', lineHeight: 1.8,
          margin: '0 0 48px', maxWidth: 520, marginLeft: 'auto', marginRight: 'auto',
        }}>
          식당, 카페, 미용실, 학원, 병원 —<br />
          쇼핑몰 없이 소개 페이지만 필요한 소상공인을 위한 서비스예요.
        </p>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/login?tab=signup" style={{
            fontSize: 15, fontWeight: 700,
            background: 'white', color: '#0a0a0a',
            textDecoration: 'none',
            padding: '15px 36px', borderRadius: 10,
          }}>
            지금 바로 시작하기 →
          </Link>
          <Link href="/preview/hongcafe" style={{
            fontSize: 15, fontWeight: 600,
            background: 'transparent', color: '#888',
            textDecoration: 'none',
            padding: '15px 36px', borderRadius: 10,
            border: '1px solid #2a2a2a',
          }}>
            데모 사이트 보기
          </Link>
        </div>
      </section>

      {/* 특징 3가지 */}
      <section style={{
        maxWidth: 900, margin: '0 auto',
        padding: '0 48px 120px',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20,
      }}>
        {[
          {
            icon: '⚡',
            title: '빠른 제작',
            desc: '템플릿 선택 후 기본 정보만 입력하면 바로 완성. 복잡한 설정 없이 오늘 바로 오픈.',
          },
          {
            icon: '💳',
            title: '월 3만원 구독',
            desc: '초기 비용 없이 월 구독료만. 도메인 연결, 게시판, 문의 폼 모두 포함.',
          },
          {
            icon: '🛠️',
            title: '본사 대리 제작',
            desc: '직접 만들기 어려우면 본사에 맡기세요. 제작 후 월 구독료만 납부하면 돼요.',
          },
        ].map(({ icon, title, desc }) => (
          <div key={title} style={{
            background: '#111', border: '1px solid #1f1f1f',
            borderRadius: 14, padding: '32px 28px',
          }}>
            <div style={{ fontSize: 28, marginBottom: 16 }}>{icon}</div>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'white' }}>{title}</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#666', lineHeight: 1.7 }}>{desc}</p>
          </div>
        ))}
      </section>

      {/* 요금 안내 */}
      <section style={{
        maxWidth: 900, margin: '0 auto',
        padding: '0 48px 120px',
      }}>
        <div style={{
          background: '#111', border: '1px solid #1f1f1f',
          borderRadius: 20, padding: '56px 48px',
          textAlign: 'center',
        }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, letterSpacing: 3, color: '#555', textTransform: 'uppercase' }}>요금 안내</p>
          <h2 style={{ margin: '0 0 8px', fontSize: 42, fontWeight: 800, letterSpacing: '-1px' }}>
            월 <span style={{ color: 'white' }}>30,000원</span>
          </h2>
          <p style={{ margin: '0 0 40px', fontSize: 14, color: '#555' }}>부가세 포함 · 언제든 해지 가능</p>

          <div style={{
            display: 'flex', justifyContent: 'center', gap: 32,
            flexWrap: 'wrap', marginBottom: 48,
          }}>
            {[
              '서브도메인 무료 제공',
              '게시판 기능 포함',
              '방문자 문의 폼 포함',
              '모바일 반응형',
              '수정 요청 월 3회',
              '커스텀 도메인 연결 가능',
            ].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#888' }}>
                <span style={{ color: '#22c55e', fontWeight: 700 }}>✓</span> {item}
              </div>
            ))}
          </div>

          <Link href="/login?tab=signup" style={{
            fontSize: 15, fontWeight: 700,
            background: 'white', color: '#0a0a0a',
            textDecoration: 'none',
            padding: '15px 48px', borderRadius: 10,
            display: 'inline-block',
          }}>
            무료로 시작하기
          </Link>
          <p style={{ margin: '16px 0 0', fontSize: 12, color: '#444' }}>
            배포 전까지는 무료 · 카드 등록 후 과금 시작
          </p>
        </div>
      </section>

      {/* 푸터 */}
      <footer style={{
        borderTop: '1px solid #1a1a1a',
        padding: '32px 48px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, color: '#444',
      }}>
        <span>© 2025 MyPlatform</span>
        <Link href="/login" style={{ color: '#444', textDecoration: 'none' }}>관리자 로그인</Link>
      </footer>

    </div>
  )
}
