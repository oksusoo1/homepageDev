import 'server-only'
import { onlyActive, USE_FLAG_ON } from '@/lib/use-flag'
import { assertPaymentSetupAllowed } from '@/lib/billing'

export async function registerBankTransfer(db, { siteId, depositorName }) {
  const gate = await assertPaymentSetupAllowed(db, siteId)
  if (!gate.ok) return { error: gate.error }

  const now = new Date().toISOString()
  const name = (depositorName || '').trim()
  if (!name) return { error: '입금자명을 입력해 주세요.' }

  const { data: existing } = await onlyActive(
    db.from('subscriptions').select('subscription_id').eq('site_id', siteId)
  ).maybeSingle()

  const draft = {
    depositor_name: name,
    bank_transfer_agreed_at: now,
  }

  if (existing) {
    const { error } = await db
      .from('subscriptions')
      .update({
        payment_method: 'manual',
        depositor_name: name,
        bank_transfer_agreed_at: now,
        updated_at: now,
      })
      .eq('site_id', siteId)
      .eq('use_flag', USE_FLAG_ON)
    if (error) return { error: error.message }
    return { error: null }
  }

  const { data: site } = await onlyActive(
    db.from('sites').select('content').eq('site_id', siteId)
  ).single()

  const content = { ...(site?.content || {}), _billing_draft: draft }
  const { error } = await db
    .from('sites')
    .update({ content, updated_at: now })
    .eq('site_id', siteId)
    .eq('use_flag', USE_FLAG_ON)
  if (error) return { error: error.message }

  return { error: null }
}
