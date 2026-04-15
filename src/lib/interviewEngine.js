import { CATEGORIES, COMPETENCY_TAGS } from '../config/categories'

export const MAX_TURNS = 5

const COMPETENCY_LIST = COMPETENCY_TAGS.map(t => `#${t.label}`).join(', ')

const SYSTEM_PROMPT = `당신은 취업 준비생의 경험을 구조화하는 전문 인터뷰어입니다.
사용자와 자연스러운 대화를 통해 경험을 STAR(Situation-Task-Action-Result) 형태의 블록으로 정리합니다.

## 핵심 원칙
1. 질문은 턴당 1~2개만. 질문 폭탄 금지.
2. 공감 먼저, 질문 나중. ("당황스러웠겠네요" → "그래서 어떻게 했어요?")
3. 사용자 답변의 키워드를 되받아치며 관심을 표현하세요.
4. "별거 없었어요" 류의 답변에는 "이건 좀 아닌데 싶었던 적 있어요?" 로 리다이렉트.
5. 사용자가 겸손하게 넘어가는 부분을 잡아서 가치를 알려주세요.
6. 반말/존댓말은 사용자에게 맞추되, 기본은 친근한 존댓말.

## 인터뷰 흐름 (총 5턴, 반드시 준수)
턴 1 (워밍업): 경험 윤곽 파악. 어떤 경험인지 + 그중 기억나는 장면 하나를 함께 물어보세요.
턴 2 (상황 파기): 맥락/규모/제약 조건을 구체화. "제일 기억에 남는 순간?" "어떤 상황이었어요?"
턴 3 (행동 파기): "그래서 어떻게 했어요?" + 꼬리질문. 구체적 행동 추출. 가장 중요한 턴.
턴 4 (결과/배움): 결과 + 배운점 확인. 긍정적 리프레이밍. 빠진 정보가 있으면 여기서 같이 보충.
턴 5 (블록 생성): 반드시 <block_json> 태그를 포함한 블록을 생성하세요. 예외 없음.

## 중요: 턴별 전략
- 턴 1~2: 넓게 질문하되, 하나의 질문에 상황+행동 단서를 함께 유도하세요.
- 턴 3: 행동이 구체적이지 않으면 선택지("A를 했나요, B를 했나요?")를 제시하세요.
- 턴 4: 결과가 약하면 "숫자로 표현하면?", "전후 비교하면?" 으로 보강하세요.
- 턴 5: 무조건 블록을 생성합니다. 정보가 부족해도 있는 내용으로 최선의 블록을 만드세요.

## 블록 생성 규칙
턴 5에서 반드시 다음 JSON을 포함한 응답을 생성하세요.
JSON은 반드시 <block_json> 태그로 감싸세요.

<block_json>
{
  "title": "블록 제목 (경험을 한 문장으로)",
  "situation": "상황 설명 (2~3문장)",
  "action": "구체적 행동 (번호 매겨서 2~4개)",
  "result": "결과 (구체적, 가능하면 수치 포함)",
  "lesson": "배운점 (한 문장, 인용문 형태)",
  "tags": ["#태그1", "#태그2", "#태그3"],
  "recommended_questions": ["추천 문항 유형1", "추천 문항 유형2"],
  "strength_score": 3,
  "ai_insight": "채용 담당자가 주목할 포인트 (2~3줄)"
}
</block_json>

## tags 작성 규칙 (중요)
tags는 반드시 다음 10개 역량 중에서만 2~4개를 선택하세요. 다른 태그 만들지 마세요.
${COMPETENCY_LIST}

## 분기 처리
- 사용자가 짧게만 답할 때: 선택지를 제시하거나 구체적으로 유도
- 여러 경험을 섞을 때: "하나씩 정리하면 어때요? 어떤 걸 먼저?" 로 분리
- 부정적 경험일 때: "힘든 경험이었지만, 그 속에서 배운 게 있다면 그게 가장 강력한 소재"
- 상황/행동/결과 중 하나가 약할 때: 해당 부분을 추가 질문으로 보강`

function getCategoryLabel(categoryId) {
  return CATEGORIES.find(c => c.id === categoryId)?.label || categoryId
}

function buildFirstMessage(categoryId) {
  const cat = getCategoryLabel(categoryId)
  const openers = {
    team_project: `팀 프로젝트 경험이 있군요! 몇 명이서, 어떤 걸 만들었는지(또는 했는지) 편하게 말해주세요. 잘 정리 안 돼도 괜찮아요.`,
    internship: `인턴이나 직무 경험을 정리해볼까요! 어떤 회사(또는 조직)에서, 어떤 일을 했는지 편하게 얘기해주세요.`,
    competition: `공모전이나 대회 경험이군요! 어떤 대회였고, 어떤 주제로 참여했는지 말해주세요.`,
    personal_project: `개인 프로젝트를 정리해볼까요! 어떤 걸 만들었는지, 왜 시작했는지 편하게 얘기해주세요.`,
    club_activity: `동아리나 대외활동 경험이군요! 어떤 활동이었고, 어떤 역할이었는지 말해주세요.`,
    part_time: `아르바이트 경험을 정리해볼게요! 어디서 어떤 일을 했는지 편하게 얘기해주세요. 사소해 보여도 좋은 소재가 많아요.`,
    certification: `자격증이나 교육 과정을 정리해볼까요! 어떤 자격증(또는 교육)이었고, 왜 도전했는지 말해주세요.`,
    overseas: `해외 경험이 있군요! 어디서 어떤 활동을 했는지 편하게 얘기해주세요.`,
  }
  return openers[categoryId] || `${cat} 경험을 정리해볼게요! 어떤 경험이었는지 편하게 말해주세요.`
}

export function createInterviewSession(categoryId) {
  const firstMessage = buildFirstMessage(categoryId)
  return {
    category: categoryId,
    messages: [
      { role: 'assistant', content: firstMessage }
    ],
    status: 'in_progress',
    turnCount: 0,
  }
}

export function buildApiMessages(session, userMessage) {
  const cat = getCategoryLabel(session.category)
  const currentTurn = session.turnCount + 1
  const isLastTurn = currentTurn >= MAX_TURNS

  let turnInstruction = `\n\n현재 카테고리: ${cat}\n현재 턴: ${currentTurn}/${MAX_TURNS}턴`
  if (isLastTurn) {
    turnInstruction += `\n\n⚠️ 마지막 턴입니다. 반드시 <block_json> 태그를 포함한 경험 블록을 생성하세요. 정보가 부족하더라도 지금까지의 대화 내용을 바탕으로 최선의 블록을 만드세요.`
  } else if (currentTurn === MAX_TURNS - 1) {
    turnInstruction += `\n\n📌 다음 턴이 마지막입니다. 이번 턴에서 결과와 배운점을 반드시 확인하세요.`
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + turnInstruction },
    ...session.messages.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ]
  return messages
}

export function parseBlockFromResponse(text) {
  if (!text) return null

  // 1. <block_json> 태그
  const taggedMatch = text.match(/<block_json>\s*([\s\S]*?)\s*<\/block_json>/)
  if (taggedMatch) {
    try { return JSON.parse(taggedMatch[1]) } catch {}
  }

  // 2. ```json ... ``` 코드 펜스
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fencedMatch) {
    try { return JSON.parse(fencedMatch[1]) } catch {}
  }

  // 3. 중괄호로 감싸인 JSON 본문 직접 추출
  const braceMatch = text.match(/\{[\s\S]*"title"[\s\S]*"situation"[\s\S]*"action"[\s\S]*\}/)
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]) } catch {}
  }

  // 4. 전체 텍스트가 JSON인 경우
  try {
    const parsed = JSON.parse(text.trim())
    if (parsed.title && parsed.situation) return parsed
  } catch {}

  return null
}

export function getDisplayText(text) {
  return text
    .replace(/<block_json>[\s\S]*?<\/block_json>/, '')
    .replace(/```(?:json)?\s*[\s\S]*?\s*```/g, '')
    .trim()
}

const BLOCK_GENERATION_PROMPT = `당신은 대화 내용을 경험 블록(STAR)으로 구조화하는 전문가입니다.

아래 대화 내용을 바탕으로 경험 블록을 생성하세요.
반드시 JSON 형식으로만 응답하세요. 다른 설명, 인사말, 머리말은 절대 포함하지 마세요.

필수 JSON 구조:
{
  "title": "블록 제목 (경험을 한 문장으로, 20자 이내)",
  "situation": "상황 설명 (2~3문장, 맥락/규모/제약 포함)",
  "action": "구체적 행동 (번호 매겨서 2~4개, 문장마다 줄바꿈)",
  "result": "결과 (구체적, 가능하면 수치)",
  "lesson": "배운점 (한 문장)",
  "tags": ["#리더십", "#협업/소통"],
  "recommended_questions": ["추천 자소서 문항 유형 2~3개"],
  "strength_score": 3,
  "ai_insight": "채용 담당자가 주목할 포인트 (2~3줄)"
}

규칙:
- 정보가 부족한 필드는 대화에서 추론하여 자연스럽게 작성
- strength_score는 1~5 (대화 정보량과 구체성 기준)
- 반드시 유효한 JSON, 다른 텍스트 금지

## tags 작성 규칙 (매우 중요)
tags는 반드시 다음 10개 역량 중에서만 2~4개를 선택하세요. 정확한 라벨을 그대로 사용하세요. 다른 태그 만들지 마세요.
${COMPETENCY_LIST}`

export function buildBlockGenerationMessages(session) {
  const cat = getCategoryLabel(session.category)
  const conversation = session.messages
    .map(m => `[${m.role === 'user' ? '지원자' : '인터뷰어'}] ${m.content}`)
    .join('\n\n')

  return [
    { role: 'system', content: BLOCK_GENERATION_PROMPT },
    {
      role: 'user',
      content: `카테고리: ${cat}\n\n=== 대화 내용 ===\n${conversation}\n\n위 대화를 바탕으로 경험 블록 JSON을 생성하세요.`
    }
  ]
}
