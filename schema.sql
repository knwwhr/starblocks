-- 경험 블록 빌더 DB 스키마
-- Supabase PostgreSQL

-- 사용자 프로필
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nickname text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);

-- 경험 블록
CREATE TABLE IF NOT EXISTS experience_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  situation text NOT NULL,
  action text NOT NULL,
  result text NOT NULL,
  lesson text,
  tags text[] DEFAULT '{}',
  recommended_questions text[] DEFAULT '{}',
  strength_score int DEFAULT 3 CHECK (strength_score BETWEEN 1 AND 5),
  ai_insight text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE experience_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own blocks" ON experience_blocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own blocks" ON experience_blocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own blocks" ON experience_blocks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own blocks" ON experience_blocks FOR DELETE USING (auth.uid() = user_id);

-- 인터뷰 세션
CREATE TABLE IF NOT EXISTS interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  block_id uuid REFERENCES experience_blocks(id) ON DELETE SET NULL,
  category text NOT NULL,
  messages jsonb DEFAULT '[]',
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  turn_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own sessions" ON interview_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON interview_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON interview_sessions FOR UPDATE USING (auth.uid() = user_id);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER experience_blocks_updated_at
  BEFORE UPDATE ON experience_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
