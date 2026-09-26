/** 사장님이 바꿀 수 있는 사이트 필드만. 금지 컬럼은 넘어와도 버린다. */

export const SITE_OWNER_FIELDS = ['name', 'description', 'address', 'phone', 'email', 'content']

export const FORBIDDEN_SITE_FIELDS = [
  'subdomain', 'domain', 'status', 'build_type', 'customer_id', 'template_id',
  'inquiry_id', 'site_code', 'site_id', 'trial_started_at', 'trial_ends_at',
  'use_flag', 'created_at',
]

export const CONTENT_JSON_MAX_BYTES = 200 * 1024
export const SITE_NAME_MAX = 200
export const SITE_TEXT_MAX = 2000

function clip(s, max) {
  const t = String(s ?? '').trim()
  return t.length > max ? t.slice(0, max) : t
}

/**
 * @returns {{ ok: true, patch: object } | { ok: false, error: string }}
 */
export function pickSiteOwnerPatch(input) {
  const src = input && typeof input === 'object' ? input : {}
  const patch = {}

  if (src.name !== undefined) {
    const name = clip(src.name, SITE_NAME_MAX)
    if (!name) return { ok: false, error: '사이트명을 입력해 주세요.' }
    patch.name = name
  }
  if (src.description !== undefined) patch.description = clip(src.description, SITE_TEXT_MAX) || null
  if (src.address !== undefined) patch.address = clip(src.address, SITE_TEXT_MAX) || null
  if (src.phone !== undefined) patch.phone = clip(src.phone, 50) || null
  if (src.email !== undefined) patch.email = clip(src.email, 200) || null

  if (src.content !== undefined) {
    if (src.content === null) {
      patch.content = {}
    } else if (typeof src.content !== 'object' || Array.isArray(src.content)) {
      return { ok: false, error: '사이트 내용 형식이 올바르지 않습니다.' }
    } else {
      let json
      try {
        json = JSON.stringify(src.content)
      } catch {
        return { ok: false, error: '사이트 내용 형식이 올바르지 않습니다.' }
      }
      if (json.length > CONTENT_JSON_MAX_BYTES) {
        return { ok: false, error: '사이트 내용이 너무 큽니다. 조금 줄여 주세요.' }
      }
      patch.content = src.content
    }
  }

  if (!Object.keys(patch).length) {
    return { ok: false, error: '바꿀 내용이 없습니다.' }
  }
  return { ok: true, patch }
}
