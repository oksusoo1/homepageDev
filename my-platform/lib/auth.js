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
 * 로그인 사용자 + staff 테이블 조회 (active만)
 *
 * @returns {{ user: object, staff: object } | null}
 */
export async function getAuthStaff() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: staff } = await supabase
    .from('staff')
    .select('*')
    .eq('auth_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!staff) return null

  return { user, staff }
}

/** /platform 접근 가능 여부 (role: platform_admin) */
export async function isPlatformAdmin() {
  const auth = await getAuthStaff()
  return auth?.staff?.role === 'platform_admin'
}

/**
 * 로그인 성공 후 이동 경로
 * staff(platform_admin) → /platform, customer → /my, 없으면 null
 */
export async function getPostLoginPath() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: staff } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (staff?.role === 'platform_admin') return '/platform'

  const { data: customer } = await supabase
    .from('customers')
    .select('customer_id')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (customer) return '/my'

  return null
}
