import { supabase } from '@/lib/supabase'

/**
 * 클라이언트 세션 확인 (페이지 진입용)
 * getSession(로컬) → 없으면 getUser(서버검증)
 * DB 조회 없음 — 프로필은 Server Action
 * @returns {Promise<object|null>} auth user
 */
export async function requireAuthUser() {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) return session.user

  const { data: { user } } = await supabase.auth.getUser()
  return user || null
}
