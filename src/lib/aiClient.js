const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

export async function sendMessage(messages, options = {}) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.')
  }

  const model = options.model || 'gemini-1.5-flash'
  const systemMessage = messages.find(m => m.role === 'system')
  const chatMessages = messages.filter(m => m.role !== 'system')

  // Gemini 형식으로 변환
  const contents = chatMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }))

  const response = await fetch(`${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
      contents,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.8,
      },
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `API 오류: ${response.status}`)
  }

  const data = await response.json()
  return data.candidates[0].content.parts[0].text
}
