// 일일 유지보수 cron — 외부 스케줄러(GitHub Actions)가 x-cron-secret 헤더로 호출.
//   1) 구독 갱신: 만료된 활성 구독 재청구(실패 시 past_due)
//   2) 블록 품질: 빈 recommended_industries 백필 (1회 N개 상한 — 비용 유계)
// service_role 로 동작. 매일 실제 read/write → Supabase 무료 플랜 킵얼라이브 부수효과.
//
// Deploy: supabase functions deploy cron-tasks --no-verify-jwt
// Secret: supabase secrets set CRON_SECRET=<랜덤>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TOSS_API = 'https://api.tosspayments.com'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const PRO_MONTHLY = 9900
const BACKFILL_LIMIT = 10 // 1회 실행당 AI 백필 상한

const RECOMMEND_INDUSTRIES_PROMPT = `당신은 커리어 컨설턴트입니다.
경험 블록의 내용을 보고, 이 경험이 특히 어필될 수 있는 업종과 직무를 추천하세요.
반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 금지.
{
  "industries": [ { "name": "업종명", "reason": "어필되는 이유 (한 줄)" } ],
  "roles": ["추천 직무 3~5개"]
}`

function extractJson(text: string) {
  if (!text) return null
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced) { try { return JSON.parse(fenced[1]) } catch { /* fall through */ } }
  const a = text.indexOf('{'), b = text.lastIndexOf('}')
  if (a !== -1 && b > a) { try { return JSON.parse(text.slice(a, b + 1)) } catch { /* fall through */ } }
  return null
}

// deno-lint-ignore no-explicit-any
function isEmptyRec(rec: any): boolean {
  return !rec || Object.keys(rec).length === 0 || !(Array.isArray(rec.industries) && rec.industries.length)
}

// deno-lint-ignore no-explicit-any
async function recommendIndustries(apiKey: string, block: any) {
  const userContent = JSON.stringify({
    title: block.title, category: block.category, situation: block.situation,
    action: block.action, result: block.result, tags: block.tags, ai_insight: block.ai_insight,
  })
  const res = await fetch(`${GEMINI_URL}/gemini-flash-latest:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: RECOMMEND_INDUSTRIES_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.5 },
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const parsed = extractJson(text)
  if (!parsed) return null
  return {
    industries: Array.isArray(parsed.industries) ? parsed.industries : [],
    roles: Array.isArray(parsed.roles) ? parsed.roles : [],
  }
}

Deno.serve(async (req) => {
  // 공유 시크릿 인증 (외부 스케줄러만 호출 가능)
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const summary = { renewed: 0, pastDue: 0, backfilled: 0, errors: [] as string[] }

  // ── 1) 구독 갱신 ──────────────────────────────────────
  try {
    const { data: due } = await admin
      .from('subscriptions')
      .select('user_id, billing_key, customer_key, current_period_end')
      .eq('status', 'active')
      .lte('current_period_end', new Date().toISOString())

    const tossSecret = Deno.env.get('TOSS_SECRET_KEY')
    const MOCK = Deno.env.get('MOCK_PAYMENTS') === 'true'

    for (const sub of due ?? []) {
      const isMock = MOCK || (sub.billing_key?.startsWith('mock_') ?? true)
      let ok = isMock
      if (!isMock && tossSecret && sub.billing_key) {
        const orderId = `prorenew_${sub.user_id.slice(0, 8)}_${Date.now()}`
        const res = await fetch(`${TOSS_API}/v1/billing/${sub.billing_key}`, {
          method: 'POST',
          headers: { Authorization: 'Basic ' + btoa(tossSecret + ':'), 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerKey: sub.customer_key, amount: PRO_MONTHLY, orderId, orderName: 'Starblocks Pro 갱신' }),
        })
        ok = res.ok
      }
      if (ok) {
        const next = new Date()
        next.setMonth(next.getMonth() + 1)
        await admin.from('subscriptions').update({ current_period_end: next.toISOString() }).eq('user_id', sub.user_id)
        summary.renewed++
      } else {
        await admin.from('subscriptions').update({ status: 'past_due' }).eq('user_id', sub.user_id)
        summary.pastDue++
      }
    }
    // TODO(알림): 갱신 D-2 사전 알림은 이메일 채널 연동 후 (현재 채널 없음).
  } catch (e) {
    summary.errors.push('renewal: ' + ((e as Error)?.message ?? String(e)))
  }

  // ── 2) 블록 추천 백필 ─────────────────────────────────
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (apiKey) {
      const { data: blocks } = await admin
        .from('experience_blocks')
        .select('id, title, category, situation, action, result, tags, ai_insight, recommended_industries')
        .order('created_at', { ascending: true })
        .limit(80)
      const targets = (blocks ?? []).filter((b) => isEmptyRec(b.recommended_industries)).slice(0, BACKFILL_LIMIT)
      for (const b of targets) {
        const rec = await recommendIndustries(apiKey, b)
        if (rec && rec.industries.length) {
          await admin.from('experience_blocks').update({ recommended_industries: rec }).eq('id', b.id)
          summary.backfilled++
        }
      }
    }
  } catch (e) {
    summary.errors.push('backfill: ' + ((e as Error)?.message ?? String(e)))
  }

  return new Response(JSON.stringify({ ok: true, ...summary }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
