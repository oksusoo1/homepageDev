import { supabase } from '@/lib/supabase'
import { onlyActive } from '@/lib/use-flag'

/**
 * 게시판 글쓰기 권한
 * - staff(본사) → 읽기만, 글쓰기 불가 (customers 겸직이어도 불가)
 * - 해당 사이트 소유 customers 만 글쓰기 가능
 *
 * @returns {{ ok: true, customer: { customer_id, name } } | { ok: false, reason: 'login'|'staff'|'other_customer' }}
 */
export async function checkSiteOwnerWriteAccess(siteCustomerId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'login' }

  // staff 면 글쓰기 차단 (공개 사이트는 읽기만)
  const { data: staff } = await onlyActive(
    supabase
      .from('staff')
      .select('staff_id')
      .eq('auth_id', user.id)
      .eq('status', 'active')
  ).maybeSingle()

  if (staff) return { ok: false, reason: 'staff' }

  const { data: customer } = await onlyActive(
    supabase
      .from('customers')
      .select('customer_id, name')
      .eq('auth_id', user.id)
  ).maybeSingle()

  if (customer && customer.customer_id === siteCustomerId) {
    return { ok: true, customer }
  }

  if (customer) return { ok: false, reason: 'other_customer' }
  return { ok: false, reason: 'login' }
}

export const WRITE_DENY_COPY = {
  login: {
    title: '로그인이 필요합니다',
    body: '게시글은 이 사이트의 소유 고객(운영자)만 작성할 수 있습니다.',
  },
  staff: {
    title: '고객만 작성할 수 있습니다',
    body: '본사(staff)는 사이트 열람만 가능합니다. 글쓰기는 사이트 소유 고객 계정으로 로그인해 주세요.',
  },
  other_customer: {
    title: '이 사이트의 운영자만 작성할 수 있습니다',
    body: '다른 고객 계정으로는 글을 쓸 수 없습니다.',
  },
}
