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

    // 구독 payment_method → 'card', status → 'active' 업데이트
    if (siteId) {
      await supabase
        .from('subscriptions')
        .update({
          payment_method: 'card',
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('site_id', siteId)
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
