-- 자소서 작업 영속화 (P2)
-- 회사별 자소서 작업물 + 문항별 답변(다수 시도) 저장

CREATE TABLE IF NOT EXISTS cover_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company text,
  position text,
  job_posting_raw text,        -- 원본 공고 텍스트 (재분석/이력용)
  job_info jsonb,              -- 파싱 결과 { keywords, requirements, ... }
  questions jsonb,             -- [{ text, charLimit }]
  match_result jsonb,          -- matchBlocksToQuestions 결과
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cover_letters_user_idx
  ON cover_letters(user_id, updated_at DESC);

ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own cover letters" ON cover_letters
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cover letters" ON cover_letters
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cover letters" ON cover_letters
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cover letters" ON cover_letters
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER cover_letters_updated_at
  BEFORE UPDATE ON cover_letters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- 문항별 답변 — 한 문항에 여러 시도(version)가 쌓일 수 있도록 설계 (P3 톤 변주 대응)
CREATE TABLE IF NOT EXISTS cover_letter_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cover_letter_id uuid REFERENCES cover_letters(id) ON DELETE CASCADE NOT NULL,
  question_index int NOT NULL,
  block_id uuid REFERENCES experience_blocks(id) ON DELETE SET NULL,
  answer text,
  used_keywords text[],
  char_count int,
  generation_options jsonb,    -- { tone, emphasis, ... } — P3에서 사용
  is_active boolean DEFAULT true, -- 동일 문항에서 가장 최근/사용자 선택 답변 1개만 active
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cover_letter_answers_letter_idx
  ON cover_letter_answers(cover_letter_id, question_index, created_at DESC);

-- 한 문항당 active=true 행은 최대 1개
CREATE UNIQUE INDEX IF NOT EXISTS cover_letter_answers_active_unique
  ON cover_letter_answers(cover_letter_id, question_index)
  WHERE is_active = true;

ALTER TABLE cover_letter_answers ENABLE ROW LEVEL SECURITY;

-- 부모 cover_letters의 user_id 기반으로 권한 체크
CREATE POLICY "Users can read own answers" ON cover_letter_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cover_letters cl
      WHERE cl.id = cover_letter_answers.cover_letter_id
        AND cl.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own answers" ON cover_letter_answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM cover_letters cl
      WHERE cl.id = cover_letter_answers.cover_letter_id
        AND cl.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own answers" ON cover_letter_answers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM cover_letters cl
      WHERE cl.id = cover_letter_answers.cover_letter_id
        AND cl.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own answers" ON cover_letter_answers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM cover_letters cl
      WHERE cl.id = cover_letter_answers.cover_letter_id
        AND cl.user_id = auth.uid()
    )
  );

CREATE TRIGGER cover_letter_answers_updated_at
  BEFORE UPDATE ON cover_letter_answers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
