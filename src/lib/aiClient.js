import { supabase } from '../config/supabase'

const FUNCTION_NAME = 'gemini-proxy'

function usageLimitMessage(scope, limit) {
  switch (scope) {
    case 'cover_letter':
      return '이 공고의 나머지 문항은 마감 패스 또는 Pro 구독으로 열 수 있어요.'
    case 'regen':
      return `이 문항은 최대 ${limit}번까지만 다시 생성할 수 있어요.`
    case 'blocks':
      return `월 블록 생성 한도(${limit}회)에 도달했습니다.`
    default:
      return 'AI 사용 한도에 도달했습니다.'
  }
}

export class UsageLimitError extends Error {
  // kind: 'limit_reached' | 'locked'
  constructor(scope, limit, kind = 'limit_reached') {
    super(usageLimitMessage(scope, limit))
    this.name = 'UsageLimitError'
    this.scope = scope
    this.limit = limit
    this.kind = kind
  }
}

export async function sendMessage(messages, options = {}) {
  const action = options.action || 'interview'

  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: {
      action,
      messages,
      model: options.model,
      maxOutputTokens: options.maxOutputTokens,
      temperature: options.temperature,
      coverLetterId: options.coverLetterId,
      questionIndex: options.questionIndex,
    },
  })

  if (error) {
    // supabase-js wraps non-2xx as FunctionsHttpError with a generic
    // "Edge Function returned a non-2xx status code" message. The function
    // itself returns { error: "..." } in the body — dig it out so the real
    // cause (quota/auth/Gemini error) surfaces instead of the generic text.
    const ctx = error.context
    const parsed = await ctx?.json?.().catch(() => null)
    const status = ctx?.status

    if (status === 402 && (parsed?.error === 'limit_reached' || parsed?.error === 'locked')) {
      throw new UsageLimitError(parsed.scope, parsed.limit, parsed.error)
    }

    // Gemini quota/rate-limit exhaustion comes back as 429 — give a clear
    // Korean message instead of the raw upstream text.
    if (status === 429) {
      throw new Error('AI 사용량이 일시적으로 초과되었습니다. 잠시 후 다시 시도해주세요.')
    }

    const detail = parsed?.error || error.message || 'AI 호출에 실패했습니다.'
    throw new Error(status ? `${detail} (status ${status})` : detail)
  }

  if (!data?.text) throw new Error('AI 응답이 비어있습니다.')
  return data.text
}
