# Starblocks (experience-block-builder)

AI 대화형 인터뷰 → STAR 경험 블록 → 공고 맞춤 자소서 자동 생성 서비스.
취준생/이직자가 경험 정리부터 자소서 완성까지 한 곳에서 끝낼 수 있도록 설계.

**Live**: https://knwwhr.github.io/starblocks/
**기획서**: [PLANNING.md](./PLANNING.md)

## 스택

- Vite 8 + React 19 + Tailwind 4 + React Router 7
- Supabase (Auth + PostgreSQL + Edge Functions)
- Gemini Flash (AI) — **서버 측 프록시를 통해서만 호출**
- 토스페이먼츠 (결제/구독) — **승인·금액 검증 전부 서버 측**
- GitHub Pages 배포 (GitHub Actions 자동) + 일일 유지보수 cron (GitHub Actions 스케줄)

## 아키텍처

```
Client (React SPA, GitHub Pages)
  │
  ├─ Supabase Auth ─ JWT
  ├─ Supabase PostgreSQL (RLS)
  │    └─ experience_blocks, interview_sessions, cover_letters,
  │       cover_letter_answers, usage_counters, passes, subscriptions
  ├─ Edge Function: gemini-proxy   (JWT 검증 + 게이팅 + 모델/토큰 캡 → Gemini)
  ├─ Edge Function: payments       (토스 승인 서버 검증 → passes/subscriptions)
  └─ Edge Function: cron-tasks     (구독 갱신 + 블록 백필, service_role)
            ▲
            └─ GitHub Actions 일 1회 호출 (x-cron-secret) + Supabase 킵얼라이브
```

- **Gemini API 키는 클라이언트에 노출되지 않습니다.** 모든 AI 호출은 `gemini-proxy` 를 거치며, 함수가 JWT 인증·생성 게이팅·모델/토큰 상한·Gemini 호출을 담당합니다.
- **결제 승인·금액 검증은 전부 서버(`payments`)에서.** 토스 secret key 로만 승인하고 `payment_key` 멱등 기록. `passes`/`subscriptions` 쓰기는 service_role 전용(클라이언트 직접 쓰기 차단).

## 로컬 개발

### 1. 환경변수

`.env.example` 을 `.env` 로 복사 후 값 채우기:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_TOSS_CLIENT_KEY=<toss-client-key>   # 결제창용 (공개 가능). 미발급 시 목 모드로 테스트
VITE_PAYMENTS_MOCK=false                 # true 면 토스 없이 결제 성공 처리 (테스트)
```

> `VITE_GEMINI_API_KEY` 는 더 이상 사용하지 않습니다. 서버 측 secret 으로만 관리됩니다.
> 토스 키 발급 전에는 `VITE_PAYMENTS_MOCK=true` + 서버 `MOCK_PAYMENTS=true` 로 결제 플로우를 끝까지 테스트할 수 있습니다 (아래 [결제 / 유료화](#결제--유료화) 참고).

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
# 1. 서버 secret 등록
npx supabase secrets set GEMINI_API_KEY=<gemini-key>
npx supabase secrets set TOSS_SECRET_KEY=<toss-secret-key>   # 결제 승인용
npx supabase secrets set CRON_SECRET=<랜덤값>                 # cron 호출 인증
# (선택) 토스 키 발급 전 결제 테스트:
npx supabase secrets set MOCK_PAYMENTS=true

# 2. 함수 배포
npx supabase functions deploy gemini-proxy
npx supabase functions deploy payments
npx supabase functions deploy cron-tasks --no-verify-jwt     # cron은 JWT 대신 x-cron-secret
```

함수 로그/상태: `https://supabase.com/dashboard/project/<ref>/functions/<name>/logs`

### GitHub Actions Secrets / Variables

리포 Settings → Secrets and variables → Actions:

**Secrets**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TOSS_CLIENT_KEY` (토스 키 발급 후)
- `CRON_SECRET` (Supabase 의 `CRON_SECRET` 과 **동일 값**)

**Variables**
- `VITE_PAYMENTS_MOCK` = `true` (토스 키 발급 전 목 모드 배포) / 발급 후 `false`

> `VITE_GEMINI_API_KEY` 는 삭제해도 됩니다.

## 사용량 / 플랜

Edge Function 에서 강제하는 권한:

| 항목 | 무료 | 마감 패스 (₩4,900) | Pro (₩9,900/월, 첫 달 ₩4,900) |
|---|---|---|---|
| 블록 생성 | 월 3회 | — | 무제한 |
| 자소서 — 공고당 문항 | **첫 문항만** | 이 공고 전 문항 | 모든 공고 전 문항 |
| 문항당 다시쓰기 | 3회 | 3회 | 3회 |

- **value-first 게이팅**: 공고당 **첫 문항은 무료로 완성본 제공** → 품질 확인 직후 나머지 문항 생성 시점에 결제 유도. `gemini-proxy` 가 잠긴 공고의 추가 문항에 `402 { error: "locked", scope: "cover_letter" }` 반환 → 클라이언트는 토스트가 아닌 **업그레이드 시트**로 분기.
- **문항당 다시쓰기 상한(3회)** 은 무료·패스·Pro 공통 (비용 유계). 초과 시 `402 { error: "limit_reached", scope: "regen" }`.
- 블록 월 한도 초과 시 `402 { scope: "blocks" }`. 위 한도는 모두 `UsageLimitError` 로 처리.

## 결제 / 유료화

목표는 **구독 전환 극대화** — 단건 마감 패스는 Pro 로 미는 앵커. 결제 시트는 구독을 기본 강조(첫 달을 단건과 동가로).

- **승인은 전부 서버(`payments`)에서.** 클라이언트가 보낸 금액 불신 → 고정가 대조 후 토스 secret key 로 승인. `payment_key` 멱등.
- `passes` = cover_letter 1건 잠금 해제 / `subscriptions` = 빌링키 기반 월 구독. 둘 다 **읽기만 RLS, 쓰기는 service_role 전용**.
- **목(테스트) 모드**: `VITE_PAYMENTS_MOCK` + `MOCK_PAYMENTS` 를 `true` 로 두면 토스 없이 결제 성공 처리(잠금 해제까지 검증). 토스 키 발급 후 둘 다 끄면 목 경로는 코드상 완전 비활성(백도어 없음).
- 리다이렉트 복귀: `/payment/success` · `/payment/fail` (`PaymentCallback`).

## 유지보수 cron

`cron-tasks` Edge Function 을 GitHub Actions 가 **매일 03:00 KST** 호출 (`.github/workflows/cron.yml`, `x-cron-secret` 인증, 수동 `workflow_dispatch` 가능):

1. **구독 갱신** — 만료된 활성 구독 재청구(실패 시 `past_due`, 목 모드는 기간 연장)
2. **블록 백필** — 빈 `recommended_industries` 채움 (1회 10개 상한)

부수효과로 **매일 실제 DB 활동 → Supabase 무료 플랜 일시정지(7일 무활동) 방지**. 외부 호출이라 멈춘 프로젝트도 깨움.

> 미구현: 구독 갱신 **D-2 사전 알림** (이메일 채널 연동 필요).

## 폴더 구조

```
src/
  contexts/          AuthContext, ToastContext
  pages/             LandingPage, LoginPage, InterviewPage,
                     BlockResultPage, BlockEditPage,
                     CoverLetterPage, DashboardPage,
                     PaymentCallback (결제 리다이렉트 복귀)
  components/        Layout, BlockPreview, UpgradeSheet (결제 시트)
  lib/               aiClient (Edge Function 호출), interviewEngine, coverLetterEngine,
                     payments (토스 연동), entitlements (Pro/패스 조회)
  config/            categories (10개 표준 역량), supabase
supabase/
  functions/
    gemini-proxy/    AI 프록시 + 생성 게이팅 (Deno)
    payments/        토스 결제 승인 + passes/subscriptions 기록
    cron-tasks/      일일 유지보수 (구독 갱신 + 블록 백필)
  migrations/        Supabase CLI 용 마이그레이션 (passes/subscriptions 포함)
.github/workflows/
  deploy.yml         GitHub Pages 배포
  cron.yml           일일 유지보수 cron 호출
migrations/          참조용 SQL (schema.sql + 수동 적용 히스토리)
```

## 라이선스

미설정 (개인 프로젝트).
