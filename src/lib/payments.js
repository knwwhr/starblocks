import { supabase } from '../config/supabase'

// 토스페이먼츠 클라이언트 키 — 라이브 동작에 필요 (키 발급 후 .env 에 설정)
const CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY || ''

// 테스트(목) 모드 — 토스 결제창 없이 바로 성공 처리. 서버의 MOCK_PAYMENTS 와 짝.
const MOCK = import.meta.env.VITE_PAYMENTS_MOCK === 'true'

// 서버(PRICES)와 반드시 동일하게 유지할 것. 표시·결제요청용.
export const PRICES = {
  pass: 4900,
  proFirstMonth: 4900,
  proMonthly: 9900,
}

function absUrl(path) {
  // import.meta.env.BASE_URL = '/starblocks/' (vite base)
  return `${window.location.origin}${import.meta.env.BASE_URL}${path}`
}

function randomOrderId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

async function tossPayment(customerKey) {
  if (!CLIENT_KEY) throw new Error('결제가 아직 설정되지 않았어요. 잠시 후 다시 시도해주세요.')
  if (!window.TossPayments) throw new Error('결제 모듈을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.')
  const toss = window.TossPayments(CLIENT_KEY)
  // customerKey 는 사용자 식별자(uuid). 빌링/결제 모두 동일 키 사용.
  return toss.payment({ customerKey })
}

// 마감 패스 단건 결제 시작 → 토스 결제창 → 성공 시 successUrl 로 리다이렉트
export async function startPassPayment({ userId, coverLetterId }) {
  if (MOCK) {
    // 결제창 건너뛰고 성공 콜백으로 직행 (테스트용)
    window.location.href = absUrl(`payment/success?kind=pass&cl=${coverLetterId}&mock=1`)
    return
  }
  const payment = await tossPayment(userId)
  await payment.requestPayment({
    method: 'CARD',
    amount: { currency: 'KRW', value: PRICES.pass },
    orderId: randomOrderId('pass'),
    orderName: '마감 패스 — 이 공고 완성',
    successUrl: absUrl(`payment/success?kind=pass&cl=${coverLetterId}`),
    failUrl: absUrl('payment/fail'),
  })
}

// Pro 구독 시작 → 카드 등록(빌링 인증) → 성공 시 successUrl 로 리다이렉트
export async function startProSubscription({ userId }) {
  if (MOCK) {
    window.location.href = absUrl('payment/success?kind=pro&mock=1')
    return
  }
  const payment = await tossPayment(userId)
  await payment.requestBillingAuth({
    method: 'CARD',
    successUrl: absUrl('payment/success?kind=pro'),
    failUrl: absUrl('payment/fail'),
  })
}

// 리다이렉트 복귀 후, 쿼리 파라미터로 서버에 결제 확정 요청
export async function confirmPayment(params) {
  const mock = params.mock === '1'
  if (params.kind === 'pass') {
    return invokePayments('confirm_pass', {
      mock,
      paymentKey: params.paymentKey,
      orderId: params.orderId,
      amount: params.amount ? Number(params.amount) : undefined,
      coverLetterId: params.cl,
    })
  }
  if (params.kind === 'pro') {
    return invokePayments('confirm_subscription', {
      mock,
      authKey: params.authKey,
      customerKey: params.customerKey,
    })
  }
  throw new Error('알 수 없는 결제 유형입니다.')
}

async function invokePayments(action, payload) {
  const { data, error } = await supabase.functions.invoke('payments', {
    body: { action, ...payload },
  })
  if (error) {
    const parsed = await error.context?.json?.().catch(() => null)
    throw new Error(parsed?.error || error.message || '결제 처리에 실패했습니다.')
  }
  return data
}
