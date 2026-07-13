-- 자소서 기반 예상 면접질문 저장 (리텐션: 면접 시즌 내내 재방문해 열람).
-- 생성은 gemini-proxy 의 interview_qgen 액션이 담당하고, 결과를 이 컬럼에 캐시.
-- 잠금 해제(Pro/패스)된 공고에서만 생성 가능 → 구독 가치 심화.

ALTER TABLE cover_letters
  ADD COLUMN IF NOT EXISTS interview_questions jsonb;

-- 구조:
-- {
--   "generatedAt": "ISO timestamp",
--   "items": [
--     { "question": "...", "intent": "면접관의 의도", "hint": "본인 경험으로 답하는 방향" }
--   ]
-- }
