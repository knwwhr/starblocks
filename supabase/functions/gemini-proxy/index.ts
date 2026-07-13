// Gemini API proxy — keeps API key server-side, enforces auth + usage limits.
// Deploy: supabase functions deploy gemini-proxy
// Set secret: supabase secrets set GEMINI_API_KEY=xxx

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Action =
  | 'interview'
  | 'block_gen'
  | 'job_parse'
  | 'block_match'
  | 'answer_gen'
  | 'industry_rec'
  | 'interview_qgen'

const FREE_LIMITS = {
  blocks_per_month: 3,
  free_regens_per_question: 3, // 문항당 다시쓰기 상한 (무료·패스·Pro 공통 — 비용 유계)
}

// 클라이언트가 보낸 model/토큰을 그대로 믿지 않는다 (비용 어뷰징 차단).
const ALLOWED_MODELS = new Set(['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'])
const MAX_OUTPUT_TOKENS_CAP = 4096

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// deno-lint-ignore no-explicit-any
async function hasActivePro(supabase: any): Promise<boolean> {
  const { data } = await supabase
    .from('subscriptions')
    .select('current_period_end')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  return !!data && new Date(data.current_period_end) > new Date()
}

// 공고가 잠금 해제되었나: Pro 구독 또는 이 공고용 마감 패스 보유
// deno-lint-ignore no-explicit-any
async function isCoverLetterUnlocked(supabase: any, coverLetterId?: string): Promise<boolean> {
  if (await hasActivePro(supabase)) return true
  if (!coverLetterId) return false
  const { data } = await supabase
    .from('passes')
    .select('id')
    .eq('cover_letter_id', coverLetterId)
    .eq('status', 'paid')
    .limit(1)
    .maybeSingle()
  return !!data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json(500, { error: 'GEMINI_API_KEY not configured' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json(401, { error: 'Missing Authorization header' })

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) return json(401, { error: 'Unauthorized' })
  const userId = userData.user.id

  let body: {
    action?: Action
    messages?: Array<{ role: string; content: string }>
    model?: string
    maxOutputTokens?: number
    temperature?: number
    coverLetterId?: string
    questionIndex?: number
  }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const { action, messages, model, maxOutputTokens, temperature, coverLetterId, questionIndex } = body
  if (!action || !Array.isArray(messages) || messages.length === 0) {
    return json(400, { error: 'action and messages required' })
  }

  // ── 블록 생성: 월 무료 한도 (Pro 무제한) ──────────────
  if (action === 'block_gen') {
    if (!(await hasActivePro(supabase))) {
      const month = new Date().toISOString().slice(0, 7) // YYYY-MM
      const { data: usage } = await supabase
        .from('usage_counters')
        .select('blocks_created')
        .eq('user_id', userId)
        .eq('month', month)
        .maybeSingle()
      if ((usage?.blocks_created ?? 0) >= FREE_LIMITS.blocks_per_month) {
        return json(402, { error: 'limit_reached', scope: 'blocks', limit: FREE_LIMITS.blocks_per_month })
      }
    }
  }

  // ── 자소서 답변: value-first 게이팅 (서버 신뢰 카운터 기반) ─────────
  //   기존엔 클라가 사후 삽입하는 cover_letter_answers 행 수로 판정 → 행을 안 넣거나
  //   coverLetterId 를 안 보내면 상한/잠금이 무력화되어 무제한 생성·유료 우회가 가능했다.
  //   이제 answer_generations(서버 전용 RPC 로만 증가)로 판정하고, 소유한 실제 공고에만
  //   생성을 허용한다.
  //   1) 문항당 생성 상한(3)은 모두에게 적용 — 비용 유계
  //   2) 잠금 해제(Pro/패스) 전에는 공고당 "첫 문항"만 무료, 나머지는 결제 유도
  if (action === 'answer_gen') {
    if (!coverLetterId || typeof questionIndex !== 'number') {
      return json(400, { error: 'coverLetterId and questionIndex required' })
    }

    // 소유 검증: 본인 공고만 (RLS 로 타인/미존재는 안 보임 → 랜덤 UUID 로 카운터 리셋 우회 차단)
    const { data: owned } = await supabase
      .from('cover_letters')
      .select('id')
      .eq('id', coverLetterId)
      .maybeSingle()
    if (!owned) return json(404, { error: 'cover_letter not found' })

    // 서버 카운터 조회 (클라 삽입 행이 아닌 answer_generations)
    const { data: genRows } = await supabase
      .from('answer_generations')
      .select('question_index, gen_count')
      .eq('cover_letter_id', coverLetterId)
    const rows = (genRows ?? []) as Array<{ question_index: number; gen_count: number }>
    const priorGenerations = rows.find((r) => r.question_index === questionIndex)?.gen_count ?? 0

    if (priorGenerations >= FREE_LIMITS.free_regens_per_question) {
      return json(402, { error: 'limit_reached', scope: 'regen', limit: FREE_LIMITS.free_regens_per_question })
    }

    // 아직 이 문항 생성 이력이 없는데(=새 문항) 잠금 상태이고, 이미 다른 문항을 한 번이라도
    // 생성했다면 → 결제 유도(locked). 첫 문항은 무료로 보여준다.
    if (priorGenerations === 0 && !(await isCoverLetterUnlocked(supabase, coverLetterId))) {
      const distinctQuestions = new Set(
        rows.filter((r) => (r.gen_count ?? 0) > 0).map((r) => r.question_index),
      ).size
      if (distinctQuestions >= 1) {
        return json(402, { error: 'locked', scope: 'cover_letter' })
      }
    }
  }

  // ── 예상 면접질문: 잠금 해제(Pro/패스)된 공고 전용 (구독 가치·리텐션) ──
  if (action === 'interview_qgen') {
    if (!coverLetterId) return json(400, { error: 'coverLetterId required' })
    const { data: owned } = await supabase
      .from('cover_letters')
      .select('id')
      .eq('id', coverLetterId)
      .maybeSingle()
    if (!owned) return json(404, { error: 'cover_letter not found' })
    if (!(await isCoverLetterUnlocked(supabase, coverLetterId))) {
      return json(402, { error: 'locked', scope: 'cover_letter' })
    }
  }

  // Build Gemini payload
  const systemMessage = messages.find((m) => m.role === 'system')
  const chatMessages = messages.filter((m) => m.role !== 'system')
  const contents = chatMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const modelName = model && ALLOWED_MODELS.has(model) ? model : 'gemini-flash-latest'
  const safeMaxTokens = Math.min(Math.max(maxOutputTokens ?? 2048, 256), MAX_OUTPUT_TOKENS_CAP)
  const safeTemp = Math.min(Math.max(temperature ?? 0.8, 0), 1.5)
  const upstream = await fetch(`${GEMINI_URL}/${modelName}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      system_instruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
      contents,
      generationConfig: {
        maxOutputTokens: safeMaxTokens,
        temperature: safeTemp,
      },
    }),
  })

  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({}))
    return json(upstream.status, { error: err?.error?.message || `Gemini error ${upstream.status}` })
  }

  const data = await upstream.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  // 사용량 카운터 증가 (성공 후에만 — 실패한 생성은 차감하지 않음).
  //   block_gen: 월별 카운터 / answer_gen: 문항별 서버 카운터(게이팅의 신뢰 소스).
  if (action === 'block_gen' && !(await hasActivePro(supabase))) {
    const month = new Date().toISOString().slice(0, 7)
    await supabase.rpc('increment_usage', { p_user_id: userId, p_month: month, p_column: 'blocks_created' })
  } else if (action === 'answer_gen') {
    await supabase.rpc('increment_answer_gen', {
      p_user_id: userId,
      p_cover_letter_id: coverLetterId,
      p_question_index: questionIndex,
    })
  }

  return json(200, { text })
})
