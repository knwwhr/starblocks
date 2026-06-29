-- 유료화: 마감 패스(단건) + Pro 구독
-- 쓰기는 payments Edge Function이 service_role 로 직접 수행 (RLS 우회).
-- 클라이언트/gemini-proxy 는 아래 SELECT 정책으로 "본인 권한"만 조회.

-- ── 마감 패스 ────────────────────────────────────────────
-- 결제 1건 = cover_letter 1개 잠금 해제. payment_key 로 멱등 보장.
CREATE TABLE IF NOT EXISTS passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL DEFAULT 'deadline' CHECK (type IN ('deadline')),
  cover_letter_id uuid REFERENCES cover_letters(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'refunded')),
  payment_key text UNIQUE NOT NULL,   -- 토스 결제 식별자 (멱등 키)
  order_id text UNIQUE NOT NULL,
  amount int NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS passes_cover_letter_idx
  ON passes(cover_letter_id) WHERE status = 'paid';

ALTER TABLE passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own passes" ON passes
  FOR SELECT USING (auth.uid() = user_id);
-- INSERT/UPDATE 정책 없음 → 클라이언트 직접 쓰기 차단. 결제 함수만 service_role 로 기록.

-- ── Pro 구독 ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due')),
  billing_key text,                   -- 토스 빌링키 (자동결제용)
  customer_key text,
  current_period_end timestamptz NOT NULL,
  first_month_used boolean DEFAULT true, -- 첫 달 할인 1회 소진 표시
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
