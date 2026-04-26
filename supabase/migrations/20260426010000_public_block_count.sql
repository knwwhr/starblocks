-- 랜딩 페이지 소셜 프루프용 — 전체 블록 수 (개인정보 없음)
-- RLS 우회로 익명 사용자도 카운트만 조회 가능

CREATE OR REPLACE FUNCTION public_block_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM experience_blocks;
$$;

REVOKE ALL ON FUNCTION public_block_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_block_count() TO anon, authenticated;
