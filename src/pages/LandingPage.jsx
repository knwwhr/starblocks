import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Repeat, Radar, FileSearch, ArrowRight, Quote } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../config/supabase'
import { Card } from '../components/ui/Card'

// ───────────── 자동 재생 데모 (압축: 2턴) ─────────────
const DEMO_SEQUENCE = [
  { role: 'assistant', content: '가장 기억에 남는 팀 프로젝트 한 가지만 들려주세요.' },
  { role: 'user',      content: '학교 축제 핸드드립 부스 운영했어요. 둘째 날 비 와서 손님이 1/3로 줄었는데...' },
  { role: 'assistant', content: '그래서 어떻게 대응하셨어요?' },
  { role: 'user',      content: '인근 카페 3곳에 도매가로 원두 처분 협상해서, 손해를 28만원 줄였어요.' },
]

const DEMO_BLOCK = {
  title: '학교 축제 핸드드립 부스 위기 대응',
  category: '팀 프로젝트',
  highlights: [
    { label: '상황', text: '우천으로 손님 1/3 급감, 원두 재고 손실 위기' },
    { label: '행동', text: '인근 카페 3곳에 도매가 협상으로 즉시 처분' },
    { label: '결과', text: '예상 손실 40만원 → 12만원으로 축소' },
  ],
  tags: ['#위기대응', '#문제해결'],
}

function DemoChat() {
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
    <div className="grid lg:grid-cols-2 gap-8 items-stretch">
      {/* 좌: 대화 */}
      <Card className="p-7 min-h-[380px] flex flex-col">
        <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-5">
          AI 인터뷰
        </div>
        <div className="space-y-3 flex-1">
          {visibleMsgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className={`max-w-[88%] text-sm px-4 py-2.5 rounded-2xl leading-relaxed ${
                m.role === 'user'
                  ? 'bg-primary-600 text-white rounded-br-sm'
                  : 'bg-slate-100 text-slate-800 rounded-bl-sm'
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
      </Card>

      {/* 우: 블록 */}
      <div className={`transition-all duration-700 ${
        showBlock ? 'opacity-100 translate-y-0' : 'opacity-25 translate-y-3'
      }`}>
        <Card accentBar="bg-sky-500" className="pl-1.5 min-h-[380px]">
          <div className="p-7 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[11px] text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full font-medium">
                {DEMO_BLOCK.category}
              </span>
              <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                <Sparkles size={11} className="text-amber-500" />
                AI 정리 결과
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-5 leading-snug">
              {DEMO_BLOCK.title}
            </h3>

            <div className="space-y-4 flex-1">
              {DEMO_BLOCK.highlights.map(({ label, text }) => (
                <div key={label} className="flex gap-3">
                  <span className="text-[11px] font-bold text-slate-400 w-9 shrink-0 pt-0.5">{label}</span>
                  <p className="text-sm text-slate-700 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5 mt-6 pt-5 border-t border-slate-100">
              {DEMO_BLOCK.tags.map(t => (
                <span key={t} className="text-[11px] bg-primary-50 text-primary-600 px-2.5 py-1 rounded-full">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ───────────── Before / After (압축) ─────────────
function BeforeAfter() {
  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="relative">
        <Quote size={36} className="absolute -top-2 -left-1 text-slate-200" strokeWidth={1.5} />
        <Card className="p-8 pt-10">
          <div className="text-[11px] font-semibold tracking-wider text-red-500 uppercase mb-4">Before</div>
          <p className="text-base text-slate-500 leading-relaxed italic">
            "어려운 상황에도 포기하지 않고 노력하여 좋은 결과를 얻었습니다."
          </p>
          <div className="mt-6 text-xs text-slate-400">
            무엇을·어떻게·얼마만큼 했는지 알 수 없음
          </div>
        </Card>
      </div>

      <div className="relative">
        <Quote size={36} className="absolute -top-2 -left-1 text-emerald-200" strokeWidth={1.5} />
        <Card accentBar="bg-emerald-500" className="pl-1.5">
          <div className="p-8 pt-10">
            <div className="text-[11px] font-semibold tracking-wider text-emerald-600 uppercase mb-4">After</div>
            <p className="text-base text-slate-800 leading-relaxed">
              "인근 카페 3곳에 도매가 협상으로 원두 처분,
              <span className="font-bold"> 손실 40만원 → 12만원으로 축소</span>"
            </p>
            <div className="mt-6 text-xs text-emerald-600">
              상황·행동·결과가 한 문장에 — 자소서·면접 어디든 그대로
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ───────────── Value props (아이콘 + 큼직한 카드) ─────────────
const VALUE_PROPS = [
  {
    Icon: Repeat,
    title: '한 번 만들면 어디든 재사용',
    desc: '자소서·면접·포트폴리오에 반복 활용',
  },
  {
    Icon: Radar,
    title: '역량 커버리지를 한눈에',
    desc: '레이더 차트로 부족한 영역과 다음 블록 추천',
  },
  {
    Icon: FileSearch,
    title: '공고 → 자소서 자동 생성',
    desc: '공고 붙여넣으면 블록 매칭 + 답변 초안',
  },
]

function ValueProps() {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      {VALUE_PROPS.map(({ Icon, title, desc }) => (
        <Card key={title} className="p-7">
          <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center mb-4">
            <Icon size={20} strokeWidth={2} />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
        </Card>
      ))}
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
    <div className="max-w-5xl mx-auto px-5 sm:px-6">
      {/* Hero */}
      <section className="text-center pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full mb-8">
          <Sparkles size={12} className="text-amber-500" />
          AI가 정리하는 STAR 경험 블록
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 mb-6 leading-[1.15] tracking-tight">
          당신의 경험을<br />
          <span className="text-primary-600">취업 무기</span>로
        </h1>

        <p className="text-lg text-slate-500 mb-10 max-w-md mx-auto leading-relaxed">
          5분 대화로 막연한 경험을<br className="sm:hidden" />
          자소서에 바로 쓸 블록으로
        </p>

        <Link
          to={user ? '/interview' : '/login'}
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-7 py-3.5 rounded-xl text-base font-medium hover:bg-primary-700 no-underline shadow-lg shadow-primary-600/25 transition-shadow hover:shadow-xl hover:shadow-primary-600/30"
        >
          시작하기
          <ArrowRight size={16} strokeWidth={2.5} />
        </Link>

        {blockCount !== null && blockCount > 0 && (
          <div className="mt-6 text-xs text-slate-400">
            지금까지 <span className="font-bold text-slate-600">{blockCount.toLocaleString('ko-KR')}개</span>의 블록이 만들어졌어요
          </div>
        )}
      </section>

      {/* 데모 */}
      <section className="py-16 sm:py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3 tracking-tight">
            대화하면, 블록이 됩니다
          </h2>
        </div>
        <DemoChat />
      </section>

      {/* Before/After */}
      <section className="py-16 sm:py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3 tracking-tight">
            같은 경험, 다른 결과
          </h2>
        </div>
        <BeforeAfter />
      </section>

      {/* Value props */}
      <section className="py-16 sm:py-20">
        <ValueProps />
      </section>

      {/* CTA */}
      <section className="text-center py-20 mb-16 bg-gradient-to-br from-primary-50 to-sky-50 rounded-3xl">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3 tracking-tight">
          5분이면 시작합니다
        </h2>
        <p className="text-sm text-slate-500 mb-8">무료 3개 블록</p>
        <Link
          to={user ? '/interview' : '/login'}
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-7 py-3.5 rounded-xl text-base font-medium hover:bg-primary-700 no-underline shadow-lg shadow-primary-600/25"
        >
          무료로 시작하기
          <ArrowRight size={16} strokeWidth={2.5} />
        </Link>
      </section>
    </div>
  )
}
