import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 서버사이드 Supabase (서비스 롤 키 사용)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(req) {
  try {
    const { authKey, customerKey, customerId, siteId } = await req.json()

    if (!authKey || !customerKey || !customerId) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
    }

    // 토스페이먼츠 빌링키 발급 API 호출
    const secretKey = process.env.TOSS_SECRET_KEY
    const encoded   = Buffer.from(secretKey + ':').toString('base64')

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

    // customer_payment_methods 저장
    const { error: pmError } = await supabase
      .from('customer_payment_methods')
      .upsert({
        customer_id:    customerId,
        pg_provider:    'toss',
        pg_customer_id: billingKey,
        card_last4:     card?.number?.slice(-4) || null,
        card_brand:     card?.company           || null,
        card_name:      card?.ownerType         || null,
        is_default:     true,
        is_active:      true,
      }, { onConflict: 'customer_id' })   // 기존 카드 덮어쓰기

    if (pmError) throw new Error(pmError.message)

    // 구독 조회
    let sub = null
    if (siteId) {
      const { data } = await supabase
        .from('subscriptions')
        .select('subscription_id, next_billing_date, cancelled_at')
        .eq('site_id', siteId)
        .maybeSingle()
      sub = data
    }

    // 즉시 결제 청구 (토스 빌링 API)
    // next_billing_date는 deploy 시 trial_ends + 1달로 설정된 값 유지
    const now = new Date()
    const orderId = `order_${siteId}_${now.getTime()}`
    const chargeRes = await fetch(`https://api.tosspayments.com/v1/billing/${billingKey}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerKey,
        amount: 30000,
        orderId,
        orderName: '홈페이지 월 구독료',
      }),
    })
    const chargeData = await chargeRes.json()
    if (!chargeRes.ok) {
      return NextResponse.json({ error: chargeData.message || '즉시 결제 실패' }, { status: 400 })
    }

    // 구독 업데이트 (재구독 시 cancelled_at/cancels_at 리셋 + next_billing_date 갱신)
    const isResubscription = !!sub?.cancelled_at
    const newNextBillingDate = (() => { const d = new Date(now); d.setMonth(d.getMonth() + 1); return d.toISOString().split('T')[0] })()

    if (siteId) {
      await supabase.from('subscriptions').update({
        payment_method: 'card',
        status: 'active',
        cancelled_at: null,
        cancels_at: null,
        updated_at: now.toISOString(),
        ...(isResubscription && { next_billing_date: newNextBillingDate }),
      }).eq('site_id', siteId)

      // 재구독 시 사이트도 published로 복원
      if (isResubscription) {
        await supabase.from('sites').update({ status: 'published', deploy_status: 'live' }).eq('site_id', siteId)
      }
    }

    // billing_history — 이번 달 즉시 결제 'paid' 기록
    if (sub?.subscription_id) {
      const period = now.toISOString().slice(0, 7)
      await supabase.from('billing_history').insert({
        subscription_id: sub.subscription_id,
        period,
        amount: 30000,
        status: 'paid',
        payment_method: 'card',
        paid_at: now.toISOString(),
        pg_transaction_id: chargeData.paymentKey || null,
      })
    }

    return NextResponse.json({
      success: true,
      card: {
        last4: card?.number?.slice(-4),
        brand: card?.company,
      },
    })

  } catch (e) {
    console.error('[billing-auth]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
