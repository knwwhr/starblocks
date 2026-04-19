# Starblocks (experience-block-builder)

AI 대화형 인터뷰 → STAR 경험 블록 → 공고 맞춤 자소서 자동 생성 서비스.
취준생/이직자가 경험 정리부터 자소서 완성까지 한 곳에서 끝낼 수 있도록 설계.

**Live**: https://knwwhr.github.io/starblocks/
**기획서**: [PLANNING.md](./PLANNING.md)

## 스택

- Vite 8 + React 19 + Tailwind 4 + React Router 7
- Supabase (Auth + PostgreSQL + Edge Functions)
- Gemini Flash (AI) — **서버 측 프록시를 통해서만 호출**
- GitHub Pages 배포 (GitHub Actions 자동)

## 아키텍처

```
Client (React SPA, GitHub Pages)
  │
  ├─ Supabase Auth ─ JWT
  ├─ Supabase PostgreSQL (RLS)
  │    └─ experience_blocks, interview_sessions, usage_counters
  └─ Supabase Edge Function: gemini-proxy
         │  (JWT 검증 + 사용량 체크 + 한도 초과 시 402)
         └─▶ Gemini API (서버 측 GEMINI_API_KEY)
```

Gemini API 키는 클라이언트에 노출되지 않습니다. 모든 AI 호출은 `gemini-proxy` Edge Function 을 거치며, 함수가 JWT 인증·월별 사용량 제한·API 호출을 담당합니다.

## 로컬 개발

### 1. 환경변수

`.env.example` 을 `.env` 로 복사 후 값 채우기:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

> `VITE_GEMINI_API_KEY` 는 더 이상 사용하지 않습니다. 서버 측 secret 으로만 관리됩니다.

### 2. 실행

```bash
npm install
npm run dev    # http://localhost:5173/starblocks/
npm run build  # production build
npm run lint
```

## 인프라 셋업 (최초 1회)

### Supabase 스키마

```bash
npx supabase login                      # 또는 SUPABASE_ACCESS_TOKEN 환경변수
npx supabase link --project-ref <ref>
npx supabase db push                    # migrations/ 적용
```

주요 테이블은 `schema.sql` 과 `supabase/migrations/` 참조.

### Edge Function 배포

```bash
# 1. Gemini API 키를 서버 secret 으로 등록
npx supabase secrets set GEMINI_API_KEY=<gemini-key>

# 2. 함수 배포
npx supabase functions deploy gemini-proxy
```

함수 로그/상태:
`https://supabase.com/dashboard/project/<ref>/functions/gemini-proxy/logs`

### GitHub Actions Secrets

리포 Settings → Secrets and variables → Actions 에 다음만 등록:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

> `VITE_GEMINI_API_KEY` 는 삭제해도 됩니다.

## 사용량 / 플랜

무료 플랜 한도 (월 단위, Edge Function 에서 강제):

| 항목 | 무료 | 프로 (예정) |
|---|---|---|
| 블록 생성 | 3 | 무제한 |
| 자소서 생성 | 1 | 무제한 |

한도 초과 시 Edge Function 이 `402` + `{ error: "limit_reached", scope, limit }` 를 반환하며, 클라이언트는 `UsageLimitError` 로 처리해 토스트로 안내합니다.

## 폴더 구조

```
src/
  contexts/          AuthContext, ToastContext
  pages/             LandingPage, LoginPage, InterviewPage,
                     BlockResultPage, BlockEditPage,
                     CoverLetterPage, DashboardPage
  components/        Layout, BlockPreview
  lib/               aiClient (Edge Function 호출), interviewEngine, coverLetterEngine
  config/            categories (10개 표준 역량), supabase
supabase/
  functions/
    gemini-proxy/    AI 프록시 (Deno)
  migrations/        Supabase CLI 용 마이그레이션
migrations/          참조용 SQL (schema.sql + 수동 적용 히스토리)
```

## 라이선스

미설정 (개인 프로젝트).
