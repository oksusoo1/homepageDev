import 'server-only'
import { onlyActive } from '@/lib/use-flag'
import { validateSubdomain, makeSiteCode } from '@/lib/subdomain-rules'

export async function assertSubdomainAvailable(db, raw) {
  const v = validateSubdomain(raw)
  if (!v.ok) return v
  const { data } = await onlyActive(
    db.from('sites').select('site_id').eq('subdomain', v.value)
  ).maybeSingle()
  if (data) return { ok: false, error: '이미 사용 중인 주소예요.' }
  return { ok: true, value: v.value }
}

export async function resolveTemplateId(db, templateId) {
  if (!templateId) return { ok: true, templateId: null }
  const { data } = await onlyActive(
    db.from('templates').select('template_id').eq('template_id', templateId)
  ).maybeSingle()
  if (!data) return { ok: false, error: '템플릿을 찾을 수 없습니다.' }
  return { ok: true, templateId }
}

export { makeSiteCode }
