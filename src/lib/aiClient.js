const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'

export async function sendMessage(messages, options = {}) {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY
  if (!apiKey) {
    throw new Error('VITE_CLAUDE_API_KEY가 설정되지 않았습니다.')
  }

  const model = options.model || 'claude-haiku-4-5-20251001'
  const systemMessage = messages.find(m => m.role === 'system')
  const chatMessages = messages.filter(m => m.role !== 'system')

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemMessage?.content || '',
      messages: chatMessages,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `API 오류: ${response.status}`)
  }

  const data = await response.json()
  return data.content[0].text
}
