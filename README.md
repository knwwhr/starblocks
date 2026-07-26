# Starblocks (experience-block-builder)

AI 대화형 인터뷰 → STAR 경험 블록 → 공고 맞춤 자소서 자동 생성 서비스.
취준생/이직자가 경험 정리부터 자소서 완성까지 한 곳에서 끝낼 수 있도록 설계.

**Live**: https://knwwhr.github.io/starblocks/
**이용 매뉴얼**: [USER_GUIDE.md](./USER_GUIDE.md)

> 이 README 가 **현재 구현 상태의 단일 기준(source of truth)** 입니다.
> 배경 문서: 기획 원본 [PLANNING.md](./PLANNING.md) · UI/자소서 개선 히스토리 [IMPROVEMENT_PLAN.md](./IMPROVEMENT_PLAN.md) (둘 다 시점 스냅샷 — 아카이브)

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
  │       cover_letter_answers, usage_counters, answer_generations,
  │       passes, subscriptions, job_postings
  ├─ Edge Function: gemini-proxy   (JWT 검증 + 게이팅 + 모델/토큰 캡 → Gemini)
  ├─ Edge Function: payments       (토스 승인 서버 검증 → passes/subscriptions)
  └─ Edge Function: cron-tasks     (구독 갱신 + 블록 백필 + 공고 인제스트, service_role)
            ▲
            └─ GitHub Actions 일 1회 호출 (x-cron-secret) + Supabase 킵얼라이브
```

- **Gemini API 키는 클라이언트에 노출되지 않습니다.** 모든 AI 호출은 `gemini-proxy` 를 거치며, 함수가 JWT 인증·생성 게이팅·모델/토큰 상한·Gemini 호출을 담당합니다.
- **결제 승인·금액 검증은 전부 서버(`payments`)에서.** 토스 secret key 로만 승인하고 `payment_key` 멱등 기록. `passes`/`subscriptions` 쓰기는 service_role 전용(클라이언트 직접 쓰기 차단).
- **자소서 생성 게이팅은 서버 신뢰 카운터(`answer_generations`) 기준.** 문항별 생성 횟수를 `SECURITY DEFINER` RPC 로만 증가시켜, 클라이언트가 저장 행을 조작하거나 `coverLetterId` 를 누락해도 상한/잠금을 우회할 수 없습니다.
- **채용공고(`job_postings`)는 cron 이 워크넷 공공 API 에서 인제스트**해 정규화 저장. 쓰기는 service_role 전용, 읽기는 로그인 사용자 공개(개인정보 아님).

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
npx supabase secrets set WORKNET_API_KEY=<worknet-authKey>   # 채용공고 인제스트(미설정 시 조용히 스킵)
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
| 예상 면접질문 | — | 이 공고 | 모든 공고 |

- **value-first 게이팅**: 공고당 **첫 문항은 무료로 완성본 제공** → 품질 확인 직후 나머지 문항 생성 시점에 결제 유도. `gemini-proxy` 가 잠긴 공고의 추가 문항에 `402 { error: "locked", scope: "cover_letter" }` 반환 → 클라이언트는 토스트가 아닌 **업그레이드 시트**로 분기.
- **문항당 다시쓰기 상한(3회)** 은 무료·패스·Pro 공통 (비용 유계). 초과 시 `402 { error: "limit_reached", scope: "regen" }`. 톤(적극적/겸손한/데이터 중심)·강조점(균형/결과/과정) 변주와 **글자수 초과 시 축약 재생성**(`condense`)도 이 상한을 공유.
- **예상 면접질문**(`interview_qgen`)은 **잠금 해제(Pro/패스)된 공고 전용** — 자소서 답변을 근거로 면접 예상질문·의도·답변 방향을 생성해 `cover_letters.interview_questions` 에 캐시(면접 시즌 리텐션). 잠긴 공고면 `402 { error: "locked" }`.
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
3. **채용공고 인제스트** — 워크넷 채용목록 API 에서 공고를 정규화해 `job_postings` 로 upsert (1회 100건 상한, `source+source_id` 멱등). **`WORKNET_API_KEY` 시크릿이 없으면 이 단계만 조용히 스킵** — 다른 유지보수 작업은 그대로 동작.

부수효과로 **매일 실제 DB 활동 → Supabase 무료 플랜 일시정지(7일 무활동) 방지**. 외부 호출이라 멈춘 프로젝트도 깨움.

> 미구현: 구독 갱신 **D-2 사전 알림** (이메일 채널 연동 필요).

## 채용공고 연동

블록을 만든 사용자에게 **맞춤 공고 → 원클릭 자소서 → 예상 면접질문**으로 이어지는 리텐션 루프.

- **인제스트**: `cron-tasks` 가 워크넷 채용목록 API(`getWantedList`)를 하루 1회 호출 → XML 파싱 → `job_postings` upsert. 제목/직종에서 매칭 키워드를 파생하고 마감일(`close_at`)을 보존.
- **추천(AI 비용 0)**: `lib/jobPostings.js` 가 사용자 블록의 태그·추천 직무/업종을 신호어로 뽑아 공고 텍스트와 **겹침 점수**로 매칭 → 상위 6개. 동점이면 마감 임박 우선. 대시보드 카드에 `D-7` 이하면 D-day 뱃지.
- **원클릭 자소서**: 추천 카드 클릭 → `posting` 을 자소서 작성 화면으로 프리필해 바로 문항 작성 시작.

### 활성화 (2가지만 하면 됨)

1. [워크넷 OpenAPI](https://www.work.go.kr/) 에 등록해 **인증키(authKey)** 발급
2. `npx supabase secrets set WORKNET_API_KEY=<authKey>` → 다음 cron 부터 `job_postings` 채워짐

> 키 미설정 상태에서도 앱은 정상 동작합니다 — 추천 로직·매칭·프리필·DB 스키마는 모두 배포돼 있고, `job_postings` 테이블만 비어 대시보드 추천이 숨겨질 뿐입니다. 키만 넣으면 별도 코드 변경 없이 살아납니다.

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
                     payments (토스 연동), entitlements (Pro/패스 조회),
                     jobPostings (공고 로드 + 블록 매칭 추천), coverLetterStore (자소서 영속화)
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
