/** 템플릿 업종 표시. 코드(cafe)는 화면에 쓰지 않는다. */

export const TEMPLATE_CATEGORIES = {
  cafe:       { label: '카페',      icon: '☕' },
  restaurant: { label: '식당',      icon: '🍽' },
  salon:      { label: '미용실',    icon: '💇' },
  clinic:     { label: '병원/의원', icon: '🏥' },
  academy:    { label: '학원',      icon: '📚' },
  general:    { label: '일반 소개', icon: '🏢' },
}

export function templateCategoryMeta(category) {
  if (category === 'all') return { label: '전체', icon: '🗂' }
  return TEMPLATE_CATEGORIES[category] || { label: category || '일반 소개', icon: '📁' }
}

export function templateCategoryLabel(category, fallback = '일반 소개') {
  if (!category) return fallback
  return TEMPLATE_CATEGORIES[category]?.label || fallback
}

/** sites.templates 조인에서 업종 코드 */
export function siteTemplateCategory(site) {
  const t = site?.templates
  const row = Array.isArray(t) ? t[0] : t
  return row?.category || null
}
