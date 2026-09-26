import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** 브라우저용. 세션은 쿠키에 저장 → 서버가 요청자를 알 수 있음 */
export const supabase = createBrowserClient(supabaseUrl, supabaseKey)
