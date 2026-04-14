import { sendMessage } from './aiClient'

const PARSE_JOB_POSTING_PROMPT = `당신은 채용 공고 분석 전문가입니다.
사용자가 붙여넣은 텍스트에서 다음 정보를 추출하세요.

반드시 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 포함하지 마세요.

{
  "company": "회사명 (못 찾으면 빈 문자열)",
  "position": "직무/포지션명 (못 찾으면 빈 문자열)",
  "questions": [
    {
      "text": "자소서 문항 전체 텍스트",
      "charLimit": 글자수 제한 (숫자, 없으면 null)
    }
  ],
  "requirements": ["핵심 자격요건/우대사항 키워드들"],
  "keywords": ["JD에서 반복 강조되는 역량/기술 키워드"]
}`

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

export async function parseJobPosting(rawText) {
  const messages = [
    { role: 'system', content: PARSE_JOB_POSTING_PROMPT },
    { role: 'user', content: rawText }
  ]
  const response = await sendMessage(messages)
  return JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
}

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
  const response = await sendMessage(messages)
  return JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
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
  const response = await sendMessage(messages)
  return JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
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
  const response = await sendMessage(messages)
  return JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
}
