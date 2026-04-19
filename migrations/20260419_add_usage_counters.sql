-- 월별 사용량 카운터 (무료/프로 플랜 제한 관리)

CREATE TABLE IF NOT EXISTS usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month text NOT NULL, -- 'YYYY-MM'
  blocks_created int DEFAULT 0,
  cover_letters_generated int DEFAULT 0,
  plan text DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'insight')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, month)
);

ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;

-- 유저는 본인 사용량만 조회 가능. 쓰기는 Edge Function(service role 또는 RPC)만.
CREATE POLICY "Users can read own usage" ON usage_counters
  FOR SELECT USING (auth.uid() = user_id);

-- Edge Function 에서 호출하는 증분 RPC (SECURITY DEFINER로 RLS 우회)
CREATE OR REPLACE FUNCTION increment_usage(
  p_user_id uuid,
  p_month text,
  p_column text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_column NOT IN ('blocks_created', 'cover_letters_generated') THEN
    RAISE EXCEPTION 'Invalid column: %', p_column;
  END IF;

  INSERT INTO usage_counters (user_id, month, blocks_created, cover_letters_generated)
  VALUES (
    p_user_id,
    p_month,
    CASE WHEN p_column = 'blocks_created' THEN 1 ELSE 0 END,
    CASE WHEN p_column = 'cover_letters_generated' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, month) DO UPDATE
  SET
    blocks_created = usage_counters.blocks_created +
      CASE WHEN p_column = 'blocks_created' THEN 1 ELSE 0 END,
    cover_letters_generated = usage_counters.cover_letters_generated +
      CASE WHEN p_column = 'cover_letters_generated' THEN 1 ELSE 0 END,
    updated_at = now();
END;
$$;

-- 인증된 유저만 RPC 호출 가능 (내부적으로 Edge Function의 auth context 사용)
REVOKE ALL ON FUNCTION increment_usage(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_usage(uuid, text, text) TO authenticated;

CREATE TRIGGER usage_counters_updated_at
  BEFORE UPDATE ON usage_counters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
