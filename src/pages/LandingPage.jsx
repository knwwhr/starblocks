import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, MapPin, Zap, Target, Lightbulb } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../config/supabase'
import { Card } from '../components/ui/Card'

// ───────────── 자동 재생 데모 ─────────────
const DEMO_SEQUENCE = [
  { role: 'assistant', content: '어떤 경험을 정리해볼까요? 가장 기억에 남는 팀 프로젝트 한 가지만 들려주세요.' },
  { role: 'user',      content: '대학 때 4명이서 학교 축제 부스 운영했어요. 솔직히 처음엔 별 기대 없었는데...' },
  { role: 'assistant', content: '오, 부스 운영! 어떤 부스였어요? 그리고 4명 중 본인 역할은 뭐였나요?' },
  { role: 'user',      content: '핸드드립 커피 부스였고, 제가 운영 총괄이었어요. 재고/원두 발주랑 인력 배치 담당.' },
  { role: 'assistant', content: '운영 총괄이면 책임이 컸겠네요. 가장 어려웠던 순간 하나만 짚어주실래요?' },
  { role: 'user',      content: '둘째 날 비 와서 손님 1/3로 줄었는데, 원두는 이미 발주된 상태라 손해 위기였어요. 즉석에서 인근 카페에 도매가로 넘기는 협상을 시도했고 결국 처분.' },
]

const DEMO_BLOCK = {
  title: '학교 축제 핸드드립 부스 운영',
  category: '팀 프로젝트',
  situation: '4명 팀의 운영 총괄로 학교 축제 핸드드립 커피 부스를 진행. 둘째 날 우천으로 손님이 평소 대비 1/3로 급감하면서 발주된 원두 재고가 손해로 이어질 위기에 처함.',
  action: '인근 카페 3곳에 직접 연락해 도매가 협상을 즉석에서 진행. 통상 가격 대비 60% 수준에 합의하고 당일 내 모든 재고 처분.',
  result: '예상 손실 약 40만원 → 12만원으로 축소. 부스는 흑자(약 80만원) 마감.',
  lesson: '예측 불가한 변수에 대비한 비상 시나리오를 미리 준비하는 것의 중요성을 배움.',
  tags: ['#위기대응', '#협업/소통', '#문제해결'],
}

function DemoChat() {
  const [step, setStep] = useState(0) // 0..n=대화, n+1=블록 등장
  const total = DEMO_SEQUENCE.length

  useEffect(() => {
    const tick = () => {
      setStep(prev => (prev >= total + 1 ? 0 : prev + 1))
    }
    const id = setInterval(tick, 2200)
    return () => clearInterval(id)
  }, [total])

  const showBlock = step > total
  const visibleMsgs = DEMO_SEQUENCE.slice(0, Math.min(step, total))

  return (
    <div className="grid md:grid-cols-2 gap-4 items-start">
      {/* 좌: 대화 */}
      <Card className="p-4 min-h-[360px]">
        <div className="text-xs font-bold text-slate-400 mb-3">AI 인터뷰 (예시)</div>
        <div className="space-y-2.5">
          {visibleMsgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className={`max-w-[85%] text-xs px-3 py-2 rounded-2xl leading-relaxed ${
                m.role === 'user'
                  ? 'bg-primary-600 text-white rounded-br-sm'
                  : 'bg-slate-100 text-slate-800 rounded-bl-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {step < total && step > 0 && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 px-3 py-2 bg-slate-100 rounded-2xl rounded-bl-sm">
                <span className="typing-dot w-1.5 h-1.5 bg-slate-400 rounded-full" />
                <span className="typing-dot w-1.5 h-1.5 bg-slate-400 rounded-full" />
                <span className="typing-dot w-1.5 h-1.5 bg-slate-400 rounded-full" />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 우: 블록 (등장 애니메이션) */}
      <div className={`transition-all duration-700 ${
        showBlock ? 'opacity-100 translate-y-0' : 'opacity-30 translate-y-2'
      }`}>
        <Card accentBar="bg-sky-500" className="pl-1 p-5 min-h-[360px]">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full font-medium">
              {DEMO_BLOCK.category}
            </span>
            <Sparkles size={12} className="text-amber-500" />
            <span className="text-[11px] text-slate-400">AI가 정리한 STAR 블록</span>
          </div>
          <h3 className="text-sm font-bold text-slate-900 mb-3">{DEMO_BLOCK.title}</h3>
          <div className="space-y-2.5 text-xs">
            {[
              { Icon: MapPin,    label: '상황',   value: DEMO_BLOCK.situation },
              { Icon: Zap,       label: '행동',   value: DEMO_BLOCK.action },
              { Icon: Target,    label: '결과',   value: DEMO_BLOCK.result },
              { Icon: Lightbulb, label: '배운점', value: DEMO_BLOCK.lesson },
            ].map(({ Icon, label, value }) => (
              <div key={label}>
                <div className="text-[11px] font-bold text-slate-400 mb-0.5 inline-flex items-center gap-1">
                  <Icon size={11} strokeWidth={2.2} />
                  {label}
                </div>
                <p className="text-slate-700 leading-relaxed line-clamp-2">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-slate-100">
            {DEMO_BLOCK.tags.map(t => (
              <span key={t} className="text-[11px] bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">
                {t}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ───────────── Before/After 비교 ─────────────
function BeforeAfter() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="p-5 border-dashed">
        <div className="text-xs font-bold text-red-500 mb-2">Before — 평범한 자기 PR</div>
        <p className="text-sm text-slate-500 leading-relaxed italic">
          "저는 학교 축제에서 부스를 운영하며 책임감과 팀워크를 배웠습니다.
          어려운 상황 속에서도 포기하지 않고 끝까지 노력하여 좋은 결과를 얻을 수 있었습니다.
          이러한 경험을 바탕으로 귀사에서도 최선을 다하겠습니다."
        </p>
        <div className="mt-3 text-[11px] text-slate-400">
          → 무슨 부스였는지, 무엇을 했는지, 결과가 무엇인지 모름
        </div>
      </Card>
      <Card accentBar="bg-emerald-500" className="pl-1 p-5">
        <div className="text-xs font-bold text-emerald-600 mb-2">After — STAR 블록</div>
        <p className="text-sm text-slate-700 leading-relaxed">
          "축제 둘째 날 우천으로 손님이 1/3로 줄어 원두 재고 손실이 예상됨.
          인근 카페 3곳에 도매가 협상을 즉석에서 진행, 통상가의 60%로 합의해
          <span className="font-bold"> 예상 손실 40만원을 12만원으로 축소</span>하고 부스는 흑자 마감."
        </p>
        <div className="mt-3 text-[11px] text-emerald-600">
          → 상황·행동·결과가 명확하고, 그대로 자소서/면접에 사용 가능
        </div>
      </Card>
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
    <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16">
      {/* Hero */}
      <section className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4 leading-tight tracking-tight">
          당신의 경험을<br />
          <span className="text-primary-600">취업 무기</span>로 바꿔드립니다
        </h1>
        <p className="text-base sm:text-lg text-slate-500 mb-6 max-w-xl mx-auto">
          AI와 5분 대화하면, 막연한 경험이 자소서에 바로 쓸 수 있는 STAR 블록으로 변환됩니다.
        </p>
        <Link
          to={user ? '/interview' : '/login'}
          className="inline-block bg-primary-600 text-white px-8 py-3.5 rounded-xl text-lg font-medium hover:bg-primary-700 no-underline shadow-lg shadow-primary-600/25"
        >
          경험 정리 시작하기
        </Link>
        {blockCount !== null && blockCount > 0 && (
          <div className="mt-4 text-xs text-slate-400">
            지금까지 <span className="font-bold text-slate-600">{blockCount.toLocaleString('ko-KR')}개</span>의 경험 블록이 만들어졌어요
          </div>
        )}
      </section>

      {/* 데모 */}
      <section className="mb-16">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">실제로 이렇게 동작해요</h2>
          <p className="text-sm text-slate-500">대화하면 STAR 블록이 자동으로 만들어집니다</p>
        </div>
        <DemoChat />
      </section>

      {/* Before/After */}
      <section className="mb-16">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">왜 STAR 블록인가요?</h2>
          <p className="text-sm text-slate-500">같은 경험도 정리하는 방식에 따라 결과가 달라집니다</p>
        </div>
        <BeforeAfter />
      </section>

      {/* Value props (압축) */}
      <section className="mb-16">
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { title: '한번 만들면 어디든 재사용', desc: '자소서·면접·포트폴리오에 반복 활용 가능한 자산' },
            { title: '역량 커버리지를 한눈에', desc: '레이더 차트로 부족한 역량과 다음에 만들 블록을 추천' },
            { title: '자동 매칭 + 자소서 초안', desc: '공고 붙여넣으면 블록↔문항 매칭 후 답변 자동 생성' },
          ].map(({ title, desc }) => (
            <Card key={title} className="p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-1">{title}</h3>
              <p className="text-xs text-slate-500">{desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-12 bg-primary-50 rounded-2xl">
        <h2 className="text-xl font-bold text-slate-900 mb-2">5분이면 경험 하나를 자산으로 바꿀 수 있습니다</h2>
        <p className="text-sm text-slate-500 mb-6">무료로 3개 블록까지 만들어보세요.</p>
        <Link
          to={user ? '/interview' : '/login'}
          className="inline-block bg-primary-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-primary-700 no-underline"
        >
          무료로 시작하기
        </Link>
      </section>
    </div>
  )
}
