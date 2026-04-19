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

type Action = 'interview' | 'block_gen' | 'job_parse' | 'block_match' | 'answer_gen' | 'industry_rec'

const FREE_LIMITS = {
  blocks_per_month: 3,
  cover_letters_per_month: 1,
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
  }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid JSON body' })
  }

  const { action, messages, model, maxOutputTokens, temperature } = body
  if (!action || !Array.isArray(messages) || messages.length === 0) {
    return json(400, { error: 'action and messages required' })
  }

  // Usage limit enforcement for the two billable actions.
  if (action === 'block_gen' || action === 'answer_gen') {
    const month = new Date().toISOString().slice(0, 7) // YYYY-MM
    const { data: usage } = await supabase
      .from('usage_counters')
      .select('blocks_created, cover_letters_generated, plan')
      .eq('user_id', userId)
      .eq('month', month)
      .maybeSingle()

    const plan = usage?.plan ?? 'free'
    if (plan === 'free') {
      if (action === 'block_gen' && (usage?.blocks_created ?? 0) >= FREE_LIMITS.blocks_per_month) {
        return json(402, { error: 'limit_reached', scope: 'blocks', limit: FREE_LIMITS.blocks_per_month })
      }
      if (action === 'answer_gen' && (usage?.cover_letters_generated ?? 0) >= FREE_LIMITS.cover_letters_per_month) {
        return json(402, { error: 'limit_reached', scope: 'cover_letters', limit: FREE_LIMITS.cover_letters_per_month })
      }
    }
  }

  // Build Gemini payload
  const systemMessage = messages.find((m) => m.role === 'system')
  const chatMessages = messages.filter((m) => m.role !== 'system')
  const contents = chatMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const modelName = model || 'gemini-flash-latest'
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
        maxOutputTokens: maxOutputTokens ?? 2048,
        temperature: temperature ?? 0.8,
      },
    }),
  })

  if (!upstream.ok) {
    const err = await upstream.json().catch(() => ({}))
    return json(upstream.status, { error: err?.error?.message || `Gemini error ${upstream.status}` })
  }

  const data = await upstream.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  // Increment usage counters after successful billable action.
  if (action === 'block_gen' || action === 'answer_gen') {
    const month = new Date().toISOString().slice(0, 7)
    const column = action === 'block_gen' ? 'blocks_created' : 'cover_letters_generated'
    await supabase.rpc('increment_usage', { p_user_id: userId, p_month: month, p_column: column })
  }

  return json(200, { text })
})
