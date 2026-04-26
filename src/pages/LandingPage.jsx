import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../config/supabase'

// ───────────── 자동 재생 데모 (editorial 스타일) ─────────────
const DEMO_SEQUENCE = [
  { role: 'assistant', content: '가장 기억에 남는 팀 프로젝트 한 가지만 들려주세요.' },
  { role: 'user',      content: '학교 축제 핸드드립 부스 운영했어요. 둘째 날 비 와서 손님이 1/3로 줄었는데...' },
  { role: 'assistant', content: '그래서 어떻게 대응하셨어요?' },
  { role: 'user',      content: '인근 카페 3곳에 도매가로 원두 처분 협상해서, 손해를 28만원 줄였어요.' },
]

const DEMO_BLOCK = {
  title: '학교 축제 핸드드립 부스 위기 대응',
  category: '팀 프로젝트',
  rows: [
    ['상황', '우천으로 손님 1/3 급감, 원두 재고 손실 위기'],
    ['행동', '인근 카페 3곳에 도매가 협상으로 즉시 처분'],
    ['결과', '예상 손실 40만원 → 12만원으로 축소'],
  ],
  tags: ['위기대응', '문제해결'],
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
    <div className="space-y-12">
      {/* 채팅 — 카드 없이 raw bubbles */}
      <div className="space-y-3 max-w-2xl mx-auto min-h-[260px]">
        {visibleMsgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className={`max-w-[88%] text-[15px] leading-relaxed ${
              m.role === 'user'
                ? 'bg-slate-900 text-white px-4 py-2.5 rounded-2xl rounded-br-sm'
                : 'bg-slate-100 text-slate-800 px-4 py-2.5 rounded-2xl rounded-bl-sm'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {step > 0 && step < total && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 px-3 py-2.5 bg-slate-100 rounded-2xl rounded-bl-sm">
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
          showBlock ? 'opacity-100' : 'opacity-30'
        }`}>
          <div className="w-px h-6 bg-slate-300" />
          <div className="text-[10px] tracking-widest text-slate-400 uppercase">정리</div>
          <div className="w-px h-6 bg-slate-300" />
        </div>
      </div>

      {/* 블록 — editorial 스타일, 두꺼운 좌측 보더만 */}
      <div className={`max-w-2xl mx-auto transition-all duration-700 ${
        showBlock ? 'opacity-100 translate-y-0' : 'opacity-20 translate-y-3'
      }`}>
        <article className="border-l-4 border-slate-900 pl-6 py-2">
          <div className="text-[11px] tracking-widest text-slate-400 uppercase mb-2">
            {DEMO_BLOCK.category}
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-6 leading-snug">
            {DEMO_BLOCK.title}
          </h3>
          <dl className="space-y-3">
            {DEMO_BLOCK.rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[3rem_1fr] gap-4 items-baseline">
                <dt className="text-[11px] tracking-widest text-slate-400 uppercase font-semibold">{k}</dt>
                <dd className="text-[15px] text-slate-700 leading-relaxed">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-3 mt-6 text-[12px] text-slate-500">
            {DEMO_BLOCK.tags.map(t => (
              <span key={t}>#{t}</span>
            ))}
          </div>
        </article>
      </div>
    </div>
  )
}

// ───────────── Before / After (타이포 only, no boxes) ─────────────
function BeforeAfter() {
  return (
    <div className="max-w-2xl mx-auto space-y-12">
      <div className="grid grid-cols-[5rem_1fr] gap-6 items-baseline">
        <div className="text-[11px] tracking-widest text-slate-400 uppercase font-semibold">
          기존
        </div>
        <div>
          <p className="text-[18px] sm:text-[20px] text-slate-400 leading-relaxed font-light italic">
            "어려운 상황에도 포기하지 않고<br />
            노력하여 좋은 결과를 얻었습니다."
          </p>
          <div className="mt-3 text-[13px] text-slate-400">
            ↳ 무엇을 어떻게 했는지 알 수 없음
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200" />

      <div className="grid grid-cols-[5rem_1fr] gap-6 items-baseline">
        <div className="text-[11px] tracking-widest text-slate-900 uppercase font-bold">
          블록
        </div>
        <div>
          <p className="text-[18px] sm:text-[20px] text-slate-900 leading-relaxed">
            "인근 카페 3곳에 도매가 협상으로 원두 처분,
            <br className="hidden sm:block" />
            <span className="font-bold">손실 40만원 → 12만원으로 축소.</span>"
          </p>
          <div className="mt-3 text-[13px] text-slate-600">
            ↳ 상황·행동·결과가 한 문장에
          </div>
        </div>
      </div>
    </div>
  )
}

// ───────────── Value props (numbered list) ─────────────
const VALUES = [
  {
    n: '01',
    title: '한 번 만들면 어디든 재사용',
    desc: '경험 블록은 자소서, 면접 답변, 포트폴리오에 반복 활용 가능한 자산이 됩니다.',
  },
  {
    n: '02',
    title: '역량 커버리지를 한눈에',
    desc: '레이더 차트로 어떤 역량이 부족한지 보고, 다음에 만들면 좋을 카테고리를 추천받습니다.',
  },
  {
    n: '03',
    title: '공고 붙여넣으면 자소서 초안',
    desc: '공고를 붙여넣으면 문항을 자동 분석하고, 블록을 매칭해 답변 초안을 만들어줍니다.',
  },
]

function ValueList() {
  return (
    <div className="max-w-3xl mx-auto divide-y divide-slate-200">
      {VALUES.map(({ n, title, desc }) => (
        <div key={n} className="py-8 grid grid-cols-[3rem_1fr] gap-6 items-start">
          <div className="text-sm tracking-widest text-slate-400 font-mono pt-1">{n}</div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">{title}</h3>
            <p className="text-[15px] text-slate-500 leading-relaxed">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ───────────── 섹션 헤더 헬퍼 ─────────────
function SectionEyebrow({ children }) {
  return (
    <div className="text-[11px] tracking-[0.2em] text-slate-400 uppercase font-semibold mb-3">
      {children}
    </div>
  )
}

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
        {/* HERO — 좌측 정렬, oversize 타이포, 카드 없음 */}
        <section className="pt-24 pb-32 sm:pt-32 sm:pb-40">
          <SectionEyebrow>Starblocks · Career Toolkit</SectionEyebrow>
          <h1 className="text-5xl sm:text-7xl font-bold text-slate-900 leading-[1.05] tracking-tight mb-8 max-w-3xl">
            막연한 경험을<br />
            <span className="text-slate-400">자소서에 쓸 </span>
            <span>블록으로.</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-xl leading-relaxed mb-10">
            AI와 5분 대화하면 됩니다. STAR 구조로 정리된 경험은 자소서·면접·포트폴리오 어디든 그대로 쓸 수 있어요.
          </p>
          <div className="flex items-center gap-6">
            <Link
              to={user ? '/interview' : '/login'}
              className="inline-flex items-center gap-2 bg-slate-900 text-white px-6 py-3.5 rounded-md text-base font-medium hover:bg-slate-700 no-underline transition-colors"
            >
              시작하기
              <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
            <a
              href="#how"
              className="text-sm text-slate-500 hover:text-slate-900 underline underline-offset-4 decoration-slate-300 hover:decoration-slate-500"
            >
              먼저 살펴보기
            </a>
          </div>
          {blockCount !== null && blockCount > 0 && (
            <div className="mt-12 text-xs text-slate-400">
              지금까지 <span className="font-semibold text-slate-700">{blockCount.toLocaleString('ko-KR')}</span>개의 블록이 만들어졌어요.
            </div>
          )}
        </section>

        <div className="border-t border-slate-200" />

        {/* DEMO */}
        <section id="how" className="py-24 sm:py-32">
          <div className="max-w-3xl mx-auto mb-16">
            <SectionEyebrow>How it works</SectionEyebrow>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-snug">
              대화하는 동안<br />블록이 만들어집니다.
            </h2>
          </div>
          <Demo />
        </section>

        <div className="border-t border-slate-200" />

        {/* BEFORE / AFTER */}
        <section className="py-24 sm:py-32">
          <div className="max-w-3xl mx-auto mb-16">
            <SectionEyebrow>Before / After</SectionEyebrow>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-snug">
              같은 경험,<br />다른 결과물.
            </h2>
          </div>
          <BeforeAfter />
        </section>

        <div className="border-t border-slate-200" />

        {/* VALUE LIST */}
        <section className="py-24 sm:py-32">
          <div className="max-w-3xl mx-auto mb-12">
            <SectionEyebrow>What you get</SectionEyebrow>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-snug">
              한 번 정리하면<br />계속 쓰는 자산이 됩니다.
            </h2>
          </div>
          <ValueList />
        </section>

        <div className="border-t border-slate-200" />

        {/* CTA — 박스 없는 레이아웃, 단순 한 줄 */}
        <section className="py-24 sm:py-32 text-center">
          <h2 className="text-3xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-6 leading-tight">
            5분이면<br className="sm:hidden" /> 충분합니다.
          </h2>
          <p className="text-sm text-slate-500 mb-10">무료로 블록 3개까지 만들 수 있어요.</p>
          <Link
            to={user ? '/interview' : '/login'}
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-7 py-3.5 rounded-md text-base font-medium hover:bg-slate-700 no-underline transition-colors"
          >
            시작하기
            <ArrowRight size={16} strokeWidth={2.5} />
          </Link>
        </section>
      </div>
    </div>
  )
}
