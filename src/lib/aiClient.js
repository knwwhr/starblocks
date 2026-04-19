import { supabase } from '../config/supabase'

const FUNCTION_NAME = 'gemini-proxy'

export class UsageLimitError extends Error {
  constructor(scope, limit) {
    super(`월 ${scope === 'blocks' ? '블록' : '자소서'} 생성 한도(${limit}회)에 도달했습니다.`)
    this.name = 'UsageLimitError'
    this.scope = scope
    this.limit = limit
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
    },
  })

  if (error) {
    // supabase-js wraps non-2xx as FunctionsHttpError. Dig into context.
    const ctx = error.context
    if (ctx?.status === 402) {
      const parsed = await ctx.json?.().catch(() => null)
      if (parsed?.error === 'limit_reached') {
        throw new UsageLimitError(parsed.scope, parsed.limit)
      }
    }
    throw new Error(error.message || 'AI 호출에 실패했습니다.')
  }

  if (!data?.text) throw new Error('AI 응답이 비어있습니다.')
  return data.text
}
