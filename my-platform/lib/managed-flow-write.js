import 'server-only'
import { onlyActive, USE_FLAG_OFF } from '@/lib/use-flag'
import { softDelete } from '@/lib/use-flag-write'

export async function cancelManagedIntake(db, inquiryId) {
  if (!inquiryId) throw new Error('inquiry_id가 필요합니다.')

  const { data: inq, error: inqErr } = await onlyActive(
    db
      .from('inquiries')
      .select('inquiry_id, down_paid_at, customer_id')
      .eq('inquiry_id', inquiryId)
  ).maybeSingle()
  if (inqErr) throw new Error(inqErr.message)
  if (!inq) throw new Error('문의를 찾을 수 없습니다.')
  if (inq.down_paid_at) throw new Error('선금 확인 후에는 접수 취소할 수 없습니다.')

  const { data: linkedSites, error: siteErr } = await onlyActive(
    db.from('sites').select('site_id, status').eq('inquiry_id', inquiryId)
  )
  if (siteErr) throw new Error(siteErr.message)

  const siteIds = (linkedSites || []).map(s => s.site_id)
  const now = new Date().toISOString()

  for (const siteId of siteIds) {
    const { error: sErr } = await db.from('sites').update({
      status: 'suspended',
      use_flag: USE_FLAG_OFF,
      updated_at: now,
    }).eq('site_id', siteId)
    if (sErr) throw new Error(sErr.message)

    const { data: subs } = await onlyActive(
      db.from('subscriptions').select('subscription_id').eq('site_id', siteId)
    )
    for (const sub of subs || []) {
      await softDelete(db, 'subscriptions', 'subscription_id', sub.subscription_id)
    }

    const { error: otpErr } = await db.from('one_time_payments')
      .update({ use_flag: USE_FLAG_OFF })
      .eq('site_id', siteId)
      .eq('use_flag', 1)
    if (otpErr) throw new Error(otpErr.message)
  }

  await softDelete(db, 'inquiries', 'inquiry_id', inquiryId)
}
