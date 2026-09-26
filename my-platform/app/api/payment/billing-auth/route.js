import { NextResponse } from 'next/server'
import { requireOwnedSiteByCode } from '@/lib/server/guard'
import { onlyActive } from '@/lib/use-flag'
import {
  isResubscribeCharge,
  replaceCustomerCard,
  applyCardResubscribe,
} from '@/lib/payment/card-policy'

export async function POST(req) {
  try {
    const { authKey, customerKey, siteCode } = await req.json()

    if (!authKey || !customerKey || !siteCode) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
    }

    const gate = await requireOwnedSiteByCode(siteCode)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: 401 })
    }

    const { db, site, customer } = gate

    const secretKey = process.env.TOSS_SECRET_KEY
    const encoded = Buffer.from(secretKey + ':').toString('base64')

    const tossRes = await fetch(
      `https://api.tosspayments.com/v1/billing/authorizations/${authKey}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${encoded}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ customerKey }),
      }
    )

    const tossData = await tossRes.json()
    if (!tossRes.ok) {
      return NextResponse.json({ error: tossData.message || '빌링키 발급 실패' }, { status: 400 })
    }

    const { billingKey, card } = tossData
    const last4 = card?.number?.slice(-4) || null

    await replaceCustomerCard(db, customer.customer_id, {
      billingKey,
      last4,
      brand: card?.company || null,
      name: card?.ownerType || null,
    })

    const { data: sub } = await onlyActive(
      db.from('subscriptions')
        .select('subscription_id, next_billing_date, cancelled_at, amount')
        .eq('site_id', site.site_id)
    ).maybeSingle()

    const now = new Date()
    const resubscribe = isResubscribeCharge(site, sub)

    // 즉시 결제: 재구독(해지·정지)일 때만. 체험 전·중은 청구 배치가 첫 결제
    // next_billing_date = 체험 종료일 (lib/trial.js calcTrialWindow)
    if (resubscribe && sub) {
      const chargeRes = await fetch(`https://api.tosspayments.com/v1/billing/${billingKey}`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${encoded}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerKey,
          amount: sub.amount || 30000,
          orderId: `order_${site.site_id}_${now.getTime()}`,
          orderName: '홈페이지 월 구독료',
        }),
      })
      const chargeData = await chargeRes.json()
      if (!chargeRes.ok) {
        return NextResponse.json({ error: chargeData.message || '즉시 결제 실패' }, { status: 400 })
      }

      await applyCardResubscribe(db, {
        site,
        sub,
        now,
        pgTransactionId: chargeData.paymentKey || null,
        note: '재구독 즉시 결제',
      })
    } else if (sub) {
      await db.from('subscriptions').update({
        payment_method: 'card',
        updated_at: now.toISOString(),
      }).eq('site_id', site.site_id)
    }

    return NextResponse.json({
      success: true,
      card: {
        last4,
        brand: card?.company,
      },
    })
  } catch (e) {
    console.error('[billing-auth]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
