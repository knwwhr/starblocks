import { sendMessage } from './aiClient'

const PARSE_JOB_POSTING_PROMPT = `당신은 채용 공고 분석 전문가입니다.
사용자가 붙여넣은 텍스트에서 다음 정보를 추출하세요.

반드시 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트, 설명, 머리말, 마크다운 펜스 금지.

{
  "company": "회사명 (못 찾으면 빈 문자열)",
  "position": "직무/포지션명 (못 찾으면 빈 문자열)",
  "questions": [
    {
      "text": "자소서 문항 전체 텍스트",
      "charLimit": null
    }
  ],
  "requirements": ["핵심 자격요건/우대사항 키워드들 (5~10개)"],
  "keywords": ["JD에서 반복 강조되는 역량/기술 키워드 (5~10개)"]
}

규칙:
- 자소서 문항이 명시되지 않은 공고도 많음. 그런 경우 questions는 빈 배열 []
- charLimit은 명시된 경우만 숫자, 아니면 null
- 회사명을 모르면 "company"는 빈 문자열 ""
- 반드시 유효한 JSON. 따옴표 이스케이프 주의.`

const MATCH_BLOCKS_PROMPT = `당신은 자소서 컨설턴트입니다.
자소서 문항과 사용자의 경험 블록들을 보고, 각 문항에 가장 적합한 블록을 매칭하세요.

## 매칭 원칙
1. 문항이 요구하는 역량과 블록의 태그/내용이 일치하는 것을 우선
2. 하나의 블록을 여러 문항에 쓰지 않도록 (가능한 분산)
3. 매칭 가능한 블록이 없으면 null

반드시 아래 JSON 형식으로만 응답하세요.

{
  "matches": [
    {
      "questionIndex": 0,
      "blockId": "매칭된 블록 ID (없으면 null)",
      "reason": "이 블록을 선택한 이유 (한 줄)"
    }
  ],
  "overallFit": "전체 매칭도를 0~100 숫자로",
  "missingAreas": ["부족한 역량/경험 영역"]
}`

const GENERATE_ANSWER_PROMPT = `당신은 자소서 작성 전문가입니다.
주어진 경험 블록과 채용 공고 정보를 바탕으로 자소서 답변을 작성하세요.

## 작성 원칙
1. 블록의 STAR 내용을 그대로 활용하되, 문항에 맞게 재구성
2. JD의 키워드/요구사항을 자연스럽게 녹여넣기
3. 구체적 수치, 행동, 결과를 반드시 포함
4. 글자수 제한을 반드시 지킬 것
5. 자연스러운 한국어 문체, 과도한 미사여구 금지
6. AI가 쓴 티가 나지 않게, 지원자 본인의 목소리로

반드시 아래 JSON 형식으로만 응답하세요.

{
  "answer": "자소서 답변 본문",
  "charCount": 글자수,
  "usedKeywords": ["JD에서 활용한 키워드"]
}`

const RECOMMEND_INDUSTRIES_PROMPT = `당신은 커리어 컨설턴트입니다.
경험 블록의 내용을 보고, 이 경험이 특히 어필될 수 있는 업종과 직무를 추천하세요.

반드시 아래 JSON 형식으로만 응답하세요.

{
  "industries": [
    { "name": "업종명", "reason": "이 경험이 어필되는 이유 (한 줄)" }
  ],
  "roles": ["추천 직무/포지션 (3~5개)"]
}`

// 강건한 JSON 추출 (태그/펜스/중괄호/전체 순서로 시도)
function extractJson(text) {
  if (!text) return null

  // 1. ```json ... ``` 또는 ``` ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced) {
    try { return JSON.parse(fenced[1]) } catch {}
  }

  // 2. 첫 { 부터 마지막 } 까지
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(text.slice(firstBrace, lastBrace + 1)) } catch {}
  }

  // 3. 전체를 그대로
  try { return JSON.parse(text.trim()) } catch {}

  return null
}

export async function parseJobPosting(rawText) {
  const messages = [
    { role: 'system', content: PARSE_JOB_POSTING_PROMPT },
    { role: 'user', content: rawText }
  ]
  // 공고가 긴 경우 대비 토큰 확보
  const response = await sendMessage(messages, { action: 'job_parse', maxOutputTokens: 2048, temperature: 0.3 })
  const parsed = extractJson(response)
  if (!parsed) {
    throw new Error('공고 분석 결과를 JSON으로 해석하지 못했습니다.')
  }
  return {
    company: parsed.company || '',
    position: parsed.position || '',
    questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
  }
}

// 기본 자소서 문항 (공고에 문항이 없을 때 사용)
export const DEFAULT_QUESTIONS = [
  { text: '해당 직무에 지원한 이유와 관련 경험을 서술해주세요.', charLimit: 800 },
  { text: '본인의 강점과 이를 활용한 경험을 구체적으로 서술해주세요.', charLimit: 500 },
  { text: '팀워크를 발휘하거나 어려움을 극복한 경험을 서술해주세요.', charLimit: 500 },
  { text: '입사 후 기여하고 싶은 부분과 향후 목표를 서술해주세요.', charLimit: 500 },
]

export async function matchBlocksToQuestions(questions, blocks, requirements) {
  const blocksData = blocks.map(b => ({
    id: b.id,
    title: b.title,
    category: b.category,
    tags: b.tags,
    situation: b.situation,
    action: b.action,
    result: b.result,
    lesson: b.lesson,
    strength_score: b.strength_score,
  }))

  const messages = [
    { role: 'system', content: MATCH_BLOCKS_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        questions: questions.map((q, i) => ({ index: i, text: q.text })),
        blocks: blocksData,
        requirements,
      })
    }
  ]
  const response = await sendMessage(messages, { action: 'block_match', maxOutputTokens: 2048, temperature: 0.3 })
  const parsed = extractJson(response)
  if (!parsed) throw new Error('블록 매칭 결과를 해석하지 못했습니다.')
  return {
    matches: Array.isArray(parsed.matches) ? parsed.matches : [],
    overallFit: typeof parsed.overallFit === 'number' ? parsed.overallFit : parseInt(parsed.overallFit) || 0,
    missingAreas: Array.isArray(parsed.missingAreas) ? parsed.missingAreas : [],
  }
}

export async function generateAnswer(question, block, jobInfo) {
  const messages = [
    { role: 'system', content: GENERATE_ANSWER_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        question: question.text,
        charLimit: question.charLimit || 500,
        block: {
          title: block.title,
          situation: block.situation,
          action: block.action,
          result: block.result,
          lesson: block.lesson,
          tags: block.tags,
          ai_insight: block.ai_insight,
        },
        company: jobInfo.company,
        position: jobInfo.position,
        requirements: jobInfo.requirements,
        keywords: jobInfo.keywords,
      })
    }
  ]
  const response = await sendMessage(messages, { action: 'answer_gen', maxOutputTokens: 2048, temperature: 0.7 })
  const parsed = extractJson(response)
  if (!parsed) throw new Error('자소서 생성 결과를 해석하지 못했습니다.')
  return {
    answer: parsed.answer || '',
    charCount: parsed.charCount || (parsed.answer?.length ?? 0),
    usedKeywords: Array.isArray(parsed.usedKeywords) ? parsed.usedKeywords : [],
  }
}

export async function recommendIndustries(block) {
  const messages = [
    { role: 'system', content: RECOMMEND_INDUSTRIES_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        title: block.title,
        category: block.category,
        situation: block.situation,
        action: block.action,
        result: block.result,
        tags: block.tags,
        ai_insight: block.ai_insight,
      })
    }
  ]
  const response = await sendMessage(messages, { action: 'industry_rec', maxOutputTokens: 1024, temperature: 0.5 })
  const parsed = extractJson(response)
  if (!parsed) return { industries: [], roles: [] }
  return {
    industries: Array.isArray(parsed.industries) ? parsed.industries : [],
    roles: Array.isArray(parsed.roles) ? parsed.roles : [],
  }
}
