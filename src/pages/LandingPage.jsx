import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowDown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../config/supabase'

// ───────────── 자동 재생 데모 ─────────────
const DEMO_SEQUENCE = [
  { role: 'assistant', content: '가장 기억에 남는 팀 활동 하나만 들려주실래요?' },
  { role: 'user',      content: '음… 작년 학교 축제 때 부스 한 거? 비도 오고 손님도 없어서 좀 망한 거 같았는데요…' },
  { role: 'assistant', content: '어떤 부스였고, 가장 곤란했던 순간은요?' },
  { role: 'user',      content: '핸드드립 커피요. 비 와서 손님 1/3로 줄었는데, 원두는 미리 다 발주해놔서 큰일났었어요.' },
  { role: 'assistant', content: '그래서 어떻게 하셨어요?' },
  { role: 'user',      content: '주변 카페 몇 군데 돌면서 도매가로 사가달라고 했어요. 결국 좀 처분해서 손해 줄였고요.' },
]

const DEMO_BLOCK = {
  title: '학교 축제 핸드드립 부스 위기 대응',
  category: '팀 프로젝트',
  rows: [
    ['Situation', '우천으로 손님이 평소 1/3로 급감, 발주된 원두 재고가 손실로 이어질 위기'],
    ['Action',    '인근 카페 3곳에 즉석에서 도매가 협상 — 평소가의 60% 수준에 합의'],
    ['Result',    '예상 손실 40만원 → 12만원으로 70% 축소, 부스는 흑자 마감'],
  ],
  tags: ['위기대응', '문제해결', '협상력'],
}

function Demo() {
  const [step, setStep] = useState(0)
  const total = DEMO_SEQUENCE.length

  useEffect(() => {
    const id = setInterval(() => {
      setStep(prev => (prev >= total + 2 ? 0 : prev + 1))
    }, 2400)
    return () => clearInterval(id)
  }, [total])

  const showBlock = step > total
  const visibleMsgs = DEMO_SEQUENCE.slice(0, Math.min(step, total))

  return (
    <div className="space-y-14">
      {/* 채팅 */}
      <div className="space-y-4 max-w-2xl mx-auto min-h-[360px]">
        <div className="text-[12px] tracking-widest text-slate-400 uppercase font-semibold mb-2 break-keep">
          애매하게 말해도 괜찮아요
        </div>
        {visibleMsgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className={`max-w-[88%] text-[16px] leading-relaxed break-keep ${
              m.role === 'user'
                ? 'bg-primary-600 text-white px-5 py-3 rounded-2xl rounded-br-sm'
                : 'bg-slate-100 text-slate-800 px-5 py-3 rounded-2xl rounded-bl-sm'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {step > 0 && step < total && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 px-4 py-3 bg-slate-100 rounded-2xl rounded-bl-sm">
              <span className="typing-dot w-1.5 h-1.5 bg-slate-400 rounded-full" />
              <span className="typing-dot w-1.5 h-1.5 bg-slate-400 rounded-full" />
              <span className="typing-dot w-1.5 h-1.5 bg-slate-400 rounded-full" />
            </div>
          </div>
        )}
      </div>

      {/* 화살표 */}
      <div className="flex justify-center">
        <div className={`flex flex-col items-center gap-1 transition-opacity duration-500 ${
          showBlock ? 'opacity-100' : 'opacity-25'
        }`}>
          <div className="w-px h-7 bg-slate-300" />
          <div className="text-[11px] tracking-widest text-slate-400 uppercase">AI 정리</div>
          <div className="w-px h-7 bg-slate-300" />
        </div>
      </div>

      {/* 블록 — showBlock 일 때만 라벨/내용 모두 등장 */}
      {showBlock && (
        <div className="max-w-2xl mx-auto animate-fade-in">
          <div className="text-[12px] tracking-widest text-primary-600 uppercase font-bold mb-3 break-keep">
            이렇게 정리됩니다
          </div>
          <article className="border-l-4 border-primary-600 pl-7 py-3">
            <div className="text-[12px] tracking-widest text-slate-400 uppercase mb-3">
              {DEMO_BLOCK.category}
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-7 leading-snug break-keep">
              {DEMO_BLOCK.title}
            </h3>
            <dl className="space-y-5">
              {DEMO_BLOCK.rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-1 sm:grid-cols-[6.5rem_1fr] gap-1 sm:gap-5 items-baseline">
                  <dt className="text-[11px] tracking-widest text-primary-600 uppercase font-bold">{k}</dt>
                  <dd className="text-[17px] text-slate-800 leading-relaxed break-keep">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-3 mt-8 text-[13px] text-slate-500">
              {DEMO_BLOCK.tags.map(t => (
                <span key={t}>#{t}</span>
              ))}
            </div>
          </article>
        </div>
      )}
    </div>
  )
}

// ───────────── STAR 설명 ─────────────
const STAR_ROWS = [
  ['Situation', '상황', '어떤 맥락·환경이었는지'],
  ['Task',      '과제', '내가 맡은 역할과 목표'],
  ['Action',    '행동', '구체적으로 무엇을 했는지'],
  ['Result',    '결과', '어떤 변화·성과가 있었는지'],
]

function StarExplainer() {
  return (
    <div className="max-w-3xl mx-auto">
      <p className="text-[17px] text-slate-600 leading-relaxed mb-12 break-keep">
        STAR는 채용 담당자들이 가장 잘 읽는 경험 서술 구조입니다.
        막연한 자기 PR 대신 <span className="text-slate-900 font-semibold">상황·과제·행동·결과</span>의
        네 단계로 정리하면, 같은 경험도 훨씬 구체적이고 설득력 있게 들립니다.
      </p>
      <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
        {STAR_ROWS.map(([en, ko, desc]) => (
          <div
            key={en}
            className="py-6 grid grid-cols-[6rem_1fr] sm:grid-cols-[8rem_4rem_1fr] gap-x-6 gap-y-1 items-baseline"
          >
            <div className="text-[14px] tracking-widest text-primary-600 uppercase font-bold">{en}</div>
            <div className="text-[16px] font-bold text-slate-900 sm:order-none order-1 col-span-1">{ko}</div>
            <div className="text-[15px] text-slate-500 leading-relaxed col-span-2 sm:col-span-1 break-keep">
              {desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ───────────── Before / After (애니메이션) ─────────────
function BeforeAfter() {
  const [phase, setPhase] = useState(0) // 0: before only, 1: arrow, 2: after revealed
  useEffect(() => {
    const id = setInterval(() => {
      setPhase(prev => (prev + 1) % 3)
    }, 2400)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      {/* BEFORE */}
      <div>
        <div className="text-[14px] tracking-widest text-slate-700 uppercase font-bold mb-4">
          Before
        </div>
        <p className="text-[20px] sm:text-[22px] text-slate-500 leading-[1.7] font-light italic break-keep">
          "어려운 상황에도 포기하지 않고 노력하여 좋은 결과를 얻었습니다."
        </p>
        <div className="mt-3 text-[14px] text-slate-400 break-keep">
          ↳ 무엇을 어떻게 했는지 알 수 없음
        </div>
      </div>

      {/* 화살표 */}
      <div className="flex justify-center">
        <div className={`flex flex-col items-center gap-1 transition-opacity duration-500 ${
          phase >= 1 ? 'opacity-100' : 'opacity-20'
        }`}>
          <div className="w-px h-7 bg-slate-300" />
          <div className="text-[11px] tracking-widest text-slate-400 uppercase">다듬기</div>
          <ArrowDown size={14} className="text-slate-400" />
        </div>
      </div>

      {/* AFTER — 페이즈 2일 때만 보임 */}
      <div className={`transition-all duration-700 ${
        phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      }`}>
        <div className="text-[14px] tracking-widest text-primary-600 uppercase font-bold mb-4">
          After
        </div>
        <p className="text-[20px] sm:text-[22px] text-slate-900 leading-[1.7] break-keep">
          "인근 카페 3곳에 도매가 협상으로 원두 처분,
          {' '}<span className="font-bold">손실 40만원 → 12만원으로 축소.</span>"
        </p>
        <div className="mt-3 text-[14px] text-primary-700 break-keep">
          ↳ 상황·행동·결과가 한 문장에
        </div>
      </div>
    </div>
  )
}

// ───────────── Value props ─────────────
const VALUES = [
  {
    n: '01',
    title: '한 번 만들면 어디든 재사용',
    desc: '경험 블록은 자소서, 면접 답변, 포트폴리오에 반복 활용할 수 있는 자산이 됩니다.',
  },
  {
    n: '02',
    title: '역량 커버리지를 한눈에',
    desc: '레이더 차트로 어떤 역량이 부족한지 보고, 다음에 만들면 좋을 카테고리를 추천받습니다.',
  },
  {
    n: '03',
    title: '공고 붙여넣으면 자소서 초안',
    desc: '공고 텍스트를 붙여넣으면 문항을 자동 분석하고, 블록을 매칭해 답변 초안을 만들어줍니다.',
  },
]

function ValueList() {
  return (
    <div className="max-w-3xl mx-auto divide-y divide-slate-200 border-t border-b border-slate-200">
      {VALUES.map(({ n, title, desc }) => (
        <div key={n} className="py-9 grid grid-cols-[3.5rem_1fr] gap-7 items-start">
          <div className="text-[20px] tracking-wide text-primary-600 font-mono font-bold">{n}</div>
          <div>
            <h3 className="text-[22px] font-bold text-slate-900 mb-3 tracking-tight break-keep">{title}</h3>
            <p className="text-[16px] text-slate-500 leading-relaxed break-keep">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ───────────── 섹션 헤더 헬퍼 ─────────────
function SectionEyebrow({ children }) {
  return (
    <div className="text-[12px] tracking-[0.2em] text-primary-600 uppercase font-bold mb-4">
      {children}
    </div>
  )
}

// 헤드라인 공통 클래스 — Pretendard 900, 모던 sans, 궁서체 톤 완전 배제
const HEADLINE_CLS = 'font-black tracking-tight text-slate-900'

// ───────────── 메인 ─────────────
export default function LandingPage() {
  const { user } = useAuth()
  const [blockCount, setBlockCount] = useState(null)

  useEffect(() => {
    supabase.rpc('public_block_count')
      .then(({ data, error }) => {
        if (!error && typeof data === 'number') setBlockCount(data)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="bg-white">
      <div className="max-w-5xl mx-auto px-6">
        {/* HERO */}
        <section className="pt-24 pb-32 sm:pt-32 sm:pb-40">
          <SectionEyebrow>Starblocks · Career Toolkit</SectionEyebrow>
          <h1 className={`${HEADLINE_CLS} text-[3.25rem] sm:text-[4.5rem] leading-[1.1] mb-10 max-w-3xl break-keep`}>
            막연한 경험으로도<br />
            <span className="text-primary-600">자소서 쓸 수 있습니다.</span>
          </h1>
          <p className="text-[19px] text-slate-500 max-w-xl leading-relaxed mb-12 break-keep">
            AI와 5분 대화하면 됩니다. STAR 구조로 정리된 경험은
            자소서·면접·포트폴리오 어디든 그대로 쓸 수 있어요.
          </p>
          <div className="flex items-center gap-7">
            <Link
              to={user ? '/interview' : '/login'}
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-7 py-4 rounded-md text-[16px] font-medium hover:bg-primary-700 no-underline transition-colors shadow-lg shadow-primary-600/25"
            >
              시작하기
              <ArrowRight size={18} strokeWidth={2.5} />
            </Link>
            <a
              href="#star"
              className="text-[15px] text-slate-500 hover:text-slate-900 underline underline-offset-4 decoration-slate-300 hover:decoration-slate-500"
            >
              먼저 살펴보기
            </a>
          </div>
          {blockCount !== null && blockCount > 0 && (
            <div className="mt-14 text-[13px] text-slate-400">
              지금까지 <span className="font-semibold text-slate-700">{blockCount.toLocaleString('ko-KR')}</span>개의 블록이 만들어졌어요.
            </div>
          )}
        </section>

        <div className="border-t border-slate-200" />

        {/* STAR (How it works 위로) */}
        <section id="star" className="py-24 sm:py-32">
          <div className="max-w-3xl mx-auto mb-14">
            <SectionEyebrow>STAR란?</SectionEyebrow>
            <h2 className={`${HEADLINE_CLS} text-[2.125rem] sm:text-[2.75rem] leading-[1.25] break-keep`}>
              경험을 설득력 있게 만드는<br />
              4단계 구조.
            </h2>
          </div>
          <StarExplainer />
        </section>

        <div className="border-t border-slate-200" />

        {/* HOW IT WORKS */}
        <section id="how" className="py-24 sm:py-32">
          <div className="max-w-3xl mx-auto mb-20">
            <SectionEyebrow>How it works</SectionEyebrow>
            <h2 className={`${HEADLINE_CLS} text-[2.125rem] sm:text-[2.75rem] leading-[1.25] break-keep`}>
              대화 몇 마디로<br />
              내 경험이 <span className="text-primary-600">더 가치있어집니다.</span>
            </h2>
          </div>
          <Demo />
        </section>

        <div className="border-t border-slate-200" />

        {/* BEFORE / AFTER */}
        <section className="py-24 sm:py-32">
          <div className="max-w-3xl mx-auto mb-20">
            <SectionEyebrow>Before / After</SectionEyebrow>
            <h2 className={`${HEADLINE_CLS} text-[2.125rem] sm:text-[2.75rem] leading-[1.25] break-keep`}>
              같은 경험,<br />
              <span className="text-primary-600">다른 결과물.</span>
            </h2>
          </div>
          <BeforeAfter />
        </section>

        <div className="border-t border-slate-200" />

        {/* VALUE LIST */}
        <section className="py-24 sm:py-32">
          <div className="max-w-3xl mx-auto mb-16">
            <SectionEyebrow>What you get</SectionEyebrow>
            <h2 className={`${HEADLINE_CLS} text-[2.125rem] sm:text-[2.75rem] leading-[1.25] break-keep`}>
              한 번 정리하면<br />
              계속 쓰는 자산이 됩니다.
            </h2>
          </div>
          <ValueList />
        </section>

        <div className="border-t border-slate-200" />

        {/* CTA */}
        <section className="py-28 sm:py-36 text-center">
          <h2 className={`${HEADLINE_CLS} text-[2.5rem] sm:text-[3.5rem] mb-6 leading-tight break-keep`}>
            5분이면 충분합니다.
          </h2>
          <p className="text-[15px] text-slate-500 mb-10">무료로 블록 3개까지 만들 수 있어요.</p>
          <Link
            to={user ? '/interview' : '/login'}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-4 rounded-md text-[16px] font-medium hover:bg-primary-700 no-underline transition-colors shadow-lg shadow-primary-600/25"
          >
            시작하기
            <ArrowRight size={18} strokeWidth={2.5} />
          </Link>
        </section>
      </div>
    </div>
  )
}
