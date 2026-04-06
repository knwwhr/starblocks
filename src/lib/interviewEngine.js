import { CATEGORIES } from '../config/categories'

const SYSTEM_PROMPT = `당신은 취업 준비생의 경험을 구조화하는 전문 인터뷰어입니다.
사용자와 자연스러운 대화를 통해 경험을 STAR(Situation-Task-Action-Result) 형태의 블록으로 정리합니다.

## 핵심 원칙
1. 질문은 턴당 1~2개만. 질문 폭탄 금지.
2. 공감 먼저, 질문 나중. ("당황스러웠겠네요" → "그래서 어떻게 했어요?")
3. 사용자 답변의 키워드를 되받아치며 관심을 표현하세요.
4. "별거 없었어요" 류의 답변에는 "이건 좀 아닌데 싶었던 적 있어요?" 로 리다이렉트.
5. 사용자가 겸손하게 넘어가는 부분을 잡아서 가치를 알려주세요.
6. 반말/존댓말은 사용자에게 맞추되, 기본은 친근한 존댓말.

## 인터뷰 흐름 (총 7~11턴)
Phase 1 (워밍업, 1~2턴): 무슨 경험인지 대략 파악. 부담 없는 질문.
Phase 2 (상황 파기, 2~3턴): "제일 기억에 남는 순간?" 으로 상황/맥락/규모/제약 조건 구체화.
Phase 3 (행동 파기, 2~3턴): "그래서 어떻게 했어요?" + 꼬리질문으로 구체적 행동 추출. 가장 중요한 단계.
Phase 4 (결과/배움, 1~2턴): 결과 + 배운점. 긍정적 리프레이밍.
Phase 5 (블록 생성, 1턴): 대화 내용을 종합하여 아래 JSON 형태로 블록을 생성하고 가치 인사이트를 제공.

## Phase 5에서 반드시 지킬 것
대화가 충분히 이뤄졌다고 판단되면(보통 7턴 이후), 다음 JSON을 포함한 응답을 생성하세요.
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
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + `\n\n현재 카테고리: ${cat}\n현재 턴: ${session.turnCount + 1}턴` },
    ...session.messages.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage }
  ]
  return messages
}

export function parseBlockFromResponse(text) {
  const match = text.match(/<block_json>\s*([\s\S]*?)\s*<\/block_json>/)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

export function getDisplayText(text) {
  return text.replace(/<block_json>[\s\S]*?<\/block_json>/, '').trim()
}
