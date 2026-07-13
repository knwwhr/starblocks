-- 채용공고 코퍼스 (공고 연동 Phase 1).
-- 워크넷 공공 API 등에서 cron 이 인제스트해 정규화 저장. 사용자 블록과 매칭해 추천하고,
-- 클릭 시 자소서 흐름으로 프리필한다.
-- 쓰기는 service_role(cron-tasks)만. 읽기는 로그인 사용자 공개(개인정보 아님).

CREATE TABLE IF NOT EXISTS job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'worknet',   -- 출처 (worknet 등)
  source_id text NOT NULL,                   -- 원본 고유키 (워크넷 wantedAuthNo)
  company text,
  title text,                                -- 채용제목
  position text,                             -- 직무/직종명
  region text,
  employment_type text,                      -- 고용형태
  description text,                          -- 원문/요약 (자소서 프리필용)
  url text,                                   -- 원문 링크
  keywords text[] NOT NULL DEFAULT '{}',      -- 매칭용 키워드 (제목/직종 파생)
  job_code text,                              -- 직종코드
  posted_at date,
  close_at date,                              -- 마감일 (D-day, 마감 패스 연동)
  raw jsonb,                                  -- 원본 필드 보존
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS job_postings_close_at_idx ON job_postings(close_at);
CREATE INDEX IF NOT EXISTS job_postings_keywords_idx ON job_postings USING gin(keywords);

ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;

-- 로그인 사용자는 누구나 공고 열람 가능. 쓰기 정책 없음 → 클라 직접 쓰기 차단(cron service_role 만).
CREATE POLICY "Authenticated can read job_postings" ON job_postings
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER job_postings_updated_at
  BEFORE UPDATE ON job_postings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
