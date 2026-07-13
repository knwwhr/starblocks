-- 서버 신뢰 카운터: 자소서 문항별 AI 생성 횟수.
-- 배경: 기존 answer_gen 게이팅(재생성 상한 + value-first 잠금)은 클라이언트가 사후 삽입하는
--   cover_letter_answers 행 개수로 판정했다. 생성은 서버가 하고 저장은 클라가 나중에 하므로,
--   악의적 클라가 행을 안 넣거나 coverLetterId를 안 보내면 상한/잠금이 무력화되어
--   무제한 무료 생성 + 유료 우회가 가능했다.
-- 대책: gemini-proxy 가 SECURITY DEFINER RPC 로만 증가시키는 이 카운터로 게이팅을 판정한다.
--   클라이언트 직접 쓰기는 SELECT-only RLS 로 차단.

CREATE TABLE IF NOT EXISTS answer_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cover_letter_id uuid REFERENCES cover_letters(id) ON DELETE CASCADE NOT NULL,
  question_index int NOT NULL,
  gen_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (cover_letter_id, question_index)
);

CREATE INDEX IF NOT EXISTS answer_generations_cover_letter_idx
  ON answer_generations(cover_letter_id);

ALTER TABLE answer_generations ENABLE ROW LEVEL SECURITY;

-- 유저는 본인 카운터만 조회. 쓰기 정책 없음 → 직접 쓰기 차단(아래 RPC 만 증가).
CREATE POLICY "Users read own answer_generations" ON answer_generations
  FOR SELECT USING (auth.uid() = user_id);

-- 문항별 생성 횟수를 원자적으로 1 증가시키고 새 값을 반환.
-- SECURITY DEFINER 로 RLS 를 우회해 쓰되, 함수 인자로 받은 user_id 를 그대로 기록한다
-- (gemini-proxy 가 JWT 로 검증한 user_id 를 넘김).
CREATE OR REPLACE FUNCTION increment_answer_gen(
  p_user_id uuid,
  p_cover_letter_id uuid,
  p_question_index int
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO answer_generations (user_id, cover_letter_id, question_index, gen_count)
  VALUES (p_user_id, p_cover_letter_id, p_question_index, 1)
  ON CONFLICT (cover_letter_id, question_index) DO UPDATE
  SET gen_count = answer_generations.gen_count + 1,
      updated_at = now()
  RETURNING gen_count INTO v_count;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION increment_answer_gen(uuid, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_answer_gen(uuid, uuid, int) TO authenticated;

CREATE TRIGGER answer_generations_updated_at
  BEFORE UPDATE ON answer_generations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
