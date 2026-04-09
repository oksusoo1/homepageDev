import { supabase } from '@/lib/supabase'

/**
 * 로그인 사용자 + customers 테이블 조회
 * 미인증 시 null 반환
 *
 * @returns {{ user: object, customer: object } | null}
 */
export async function getAuthCustomer() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('auth_id', user.id)
    .single()

  if (!customer) return null

  return { user, customer }
}

/**
 * 관리자 이메일 화이트리스트 체크
 * 환경변수 NEXT_PUBLIC_ADMIN_EMAILS (콤마 구분)
 *
 * @param {string} email
 * @returns {boolean}
 */
export function isAdminEmail(email) {
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  // 화이트리스트가 비어있으면 모든 인증 사용자를 관리자로 취급 (개발용)
  if (adminEmails.length === 0) return true

  return adminEmails.includes(email.toLowerCase())
}
