-- 업종/직무 추천 캐시 컬럼 추가
-- 블록 생성 시 AI 추천 결과를 저장하여 재호출 비용 절감.
-- (구 최상위 migrations/ 에만 있던 것을 supabase/migrations 로 일원화하며 포팅.)

ALTER TABLE experience_blocks
  ADD COLUMN IF NOT EXISTS recommended_industries jsonb DEFAULT '{}';

-- 구조:
-- {
--   "industries": [{ "name": "IT/스타트업", "reason": "..." }, ...],
--   "roles": ["데이터 분석가", "PM", ...]
-- }
