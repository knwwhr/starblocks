// 결제 확정 프록시 — 토스페이먼츠 승인을 서버(secret key)에서만 수행하고,
// 검증 통과 시 service_role 로 passes/subscriptions 에 기록한다.
//
// Deploy: supabase functions deploy payments
// Secrets: supabase secrets set TOSS_SECRET_KEY=test_sk_xxx
//   (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY 는 자동 주입)
//
// ⚠️ 라이브 동작에는 TOSS_SECRET_KEY 가 필요합니다 (키 발급 후 설정).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TOSS_API = 'https://api.tosspayments.com'

// 서버가 신뢰하는 고정 가격 — 클라이언트가 보낸 금액은 절대 신뢰하지 않는다.
const PRICES = {
  pass: 4900,        // 마감 패스 (단건)
  pro_first: 4900,   // Pro 첫 달 할인가
  pro_monthly: 9900, // Pro 정상가 (갱신 시)
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  // 테스트(목) 모드: MOCK_PAYMENTS=true 일 때만, 실제 토스 승인 없이 권한을 부여한다.
  //   토스 키 발급 후 이 시크릿을 끄면(미설정/false) 목 경로는 완전히 비활성 → 백도어 아님.
  const MOCK = Deno.env.get('MOCK_PAYMENTS') === 'true'

  const secretKey = Deno.env.get('TOSS_SECRET_KEY')
  if (!secretKey && !MOCK) return json(500, { error: 'TOSS_SECRET_KEY not configured' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json(401, { error: 'Missing Authorization header' })

  // JWT 로 사용자 식별
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) return json(401, { error: 'Unauthorized' })
  const userId = userData.user.id

  // 쓰기는 service_role 로 (RLS 우회). 결제 검증을 통과한 경우에만 사용.
  const admin = createClient(supabaseUrl, serviceKey)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const tossAuth = 'Basic ' + btoa(secretKey + ':')

  // ── 마감 패스 단건 결제 확정 ──────────────────────────
  if (body.action === 'confirm_pass') {
    const { coverLetterId } = body
    if (!coverLetterId) return json(400, { error: 'coverLetterId required' })

    let paymentKey = body.paymentKey
    let orderId = body.orderId

    if (MOCK && body.mock) {
      // 목 모드: 토스 승인 건너뛰고 합성 식별자로 패스 부여
      paymentKey = `mock_${crypto.randomUUID()}`
      orderId = `mock_${Date.now()}`
    } else {
      if (!paymentKey || !orderId) {
        return json(400, { error: 'paymentKey, orderId required' })
      }
      if (body.amount !== PRICES.pass) {
        return json(400, { error: `invalid amount (expected ${PRICES.pass})` })
      }
      // 토스 승인 (capture) — secret key 로만 호출
      const res = await fetch(`${TOSS_API}/v1/payments/confirm`, {
        method: 'POST',
        headers: { Authorization: tossAuth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentKey, orderId, amount: body.amount }),
      })
      const pay = await res.json()
      if (!res.ok) return json(res.status, { error: pay?.message || '결제 승인 실패' })
    }

    // 패스 기록 (payment_key 중복이면 멱등 무시)
    const { error: insErr } = await admin.from('passes').upsert(
      {
        user_id: userId,
        cover_letter_id: coverLetterId,
        payment_key: paymentKey,
        order_id: orderId,
        amount: PRICES.pass,
        status: 'paid',
      },
      { onConflict: 'payment_key', ignoreDuplicates: true },
    )
    if (insErr) return json(500, { error: '패스 기록 실패' })
    return json(200, { ok: true })
  }

  // ── Pro 구독 시작 (빌링키 발급 + 첫 달 결제) ───────────
  if (body.action === 'confirm_subscription') {
    let billingKey: string
    let customerKey: string

    if (MOCK && body.mock) {
      // 목 모드: 토스 빌링/결제 건너뛰고 구독 활성화
      billingKey = `mock_${crypto.randomUUID()}`
      customerKey = userId
    } else {
      const authKey = body.authKey
      customerKey = body.customerKey
      if (!authKey || !customerKey) {
        return json(400, { error: 'authKey, customerKey required' })
      }

      // 1) authKey → billingKey 발급
      const issueRes = await fetch(`${TOSS_API}/v1/billing/authorizations/issue`, {
        method: 'POST',
        headers: { Authorization: tossAuth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ authKey, customerKey }),
      })
      const issue = await issueRes.json()
      if (!issueRes.ok) return json(issueRes.status, { error: issue?.message || '빌링키 발급 실패' })
      billingKey = issue.billingKey

      // 2) 첫 달 결제 (할인가)
      const orderId = `pro_${userId.slice(0, 8)}_${Date.now()}`
      const chargeRes = await fetch(`${TOSS_API}/v1/billing/${billingKey}`, {
        method: 'POST',
        headers: { Authorization: tossAuth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerKey,
          amount: PRICES.pro_first,
          orderId,
          orderName: 'Starblocks Pro 첫 달',
        }),
      })
      const charge = await chargeRes.json()
      if (!chargeRes.ok) return json(chargeRes.status, { error: charge?.message || '첫 달 결제 실패' })
    }

    // 3) 구독 활성화 (다음 갱신일 = 한 달 뒤)
    const periodEnd = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    const { error: subErr } = await admin.from('subscriptions').upsert(
      {
        user_id: userId,
        status: 'active',
        billing_key: billingKey,
        customer_key: customerKey,
        current_period_end: periodEnd.toISOString(),
        first_month_used: true,
      },
      { onConflict: 'user_id' },
    )
    if (subErr) return json(500, { error: '구독 기록 실패' })
    return json(200, { ok: true })
    // 갱신(current_period_end 도달분 재청구)은 cron-tasks Edge Function 이 담당.
  }

  return json(400, { error: 'unknown action' })
})
