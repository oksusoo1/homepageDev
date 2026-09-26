import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * 서버 전용 DB 클라이언트 (RLS 우회).
 * NEXT_PUBLIC_ 접두어 금지 · 클라이언트에서 import 금지.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('서버 DB 키가 설정되어 있지 않습니다.')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
