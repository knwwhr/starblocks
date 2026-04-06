import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LandingPage() {
  const { user } = useAuth()

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      {/* Hero */}
      <section className="text-center mb-20">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4 leading-tight">
          당신의 경험을<br />
          <span className="text-primary-600">취업 무기</span>로 바꿔드립니다
        </h1>
        <p className="text-lg text-slate-500 mb-8 max-w-xl mx-auto">
          AI와 5분 대화하면, 막연한 경험이 자소서에 바로 쓸 수 있는
          구조화된 블록으로 변환됩니다.
        </p>
        <Link
          to={user ? '/interview' : '/login'}
          className="inline-block bg-primary-600 text-white px-8 py-3.5 rounded-xl text-lg font-medium hover:bg-primary-700 no-underline shadow-lg shadow-primary-600/25"
        >
          경험 정리 시작하기
        </Link>
      </section>

      {/* How it works */}
      <section className="mb-20">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">어떻게 작동하나요?</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              step: '1',
              title: '경험 카테고리 선택',
              desc: '팀 프로젝트, 인턴, 공모전 등 정리하고 싶은 경험의 종류를 선택합니다.',
              emoji: '📋',
            },
            {
              step: '2',
              title: 'AI와 편하게 대화',
              desc: 'AI가 면접관처럼 질문합니다. 빈 칸을 채울 필요 없이, 그냥 말하면 됩니다.',
              emoji: '💬',
            },
            {
              step: '3',
              title: '경험 블록 완성',
              desc: 'STAR 구조로 정리된 블록이 생성됩니다. 자소서, 면접에 바로 활용하세요.',
              emoji: '✨',
            },
          ].map(({ step, title, desc, emoji }) => (
            <div key={step} className="bg-white rounded-xl border border-slate-200 p-6 text-center">
              <div className="text-4xl mb-3">{emoji}</div>
              <div className="text-xs font-bold text-primary-600 mb-1">STEP {step}</div>
              <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-sm text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Value props */}
      <section className="mb-20">
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">왜 경험 블록인가요?</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              title: '"별거 아닌" 경험에서 가치를 발견',
              desc: 'AI가 당신도 몰랐던 경험의 강점을 찾아줍니다. 채용 담당자의 관점으로 재해석합니다.',
            },
            {
              title: '한번 만들면 어디든 재사용',
              desc: '경험 블록은 자소서, 면접, 포트폴리오에 반복 활용 가능한 자산입니다.',
            },
            {
              title: '역량 커버리지를 한눈에',
              desc: '리더십, 문제해결, 기술력 등 어떤 역량이 부족한지 시각적으로 확인하세요.',
            },
            {
              title: 'ChatGPT 자소서와는 다릅니다',
              desc: 'AI가 만든 소설이 아니라, 당신의 실제 경험이 담긴 일관된 결과물입니다.',
            },
          ].map(({ title, desc }) => (
            <div key={title} className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-1">{title}</h3>
              <p className="text-sm text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-12 bg-primary-50 rounded-2xl">
        <h2 className="text-xl font-bold text-slate-900 mb-2">5분이면 경험 하나를 자산으로 바꿀 수 있습니다</h2>
        <p className="text-sm text-slate-500 mb-6">무료로 2개 블록까지 만들어보세요.</p>
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
