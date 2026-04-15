import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../config/supabase'
import { CATEGORIES, COMPETENCY_TAGS, mapTagToCompetency } from '../config/categories'

export default function BlockResultPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const savedBlock = location.state?.block

  const [allBlocks, setAllBlocks] = useState([])

  // DB에 캐싱된 추천 사용
  const recommendation = savedBlock?.recommended_industries && Object.keys(savedBlock.recommended_industries).length > 0
    ? savedBlock.recommended_industries
    : null
  const loadingRec = false

  useEffect(() => {
    if (!savedBlock) {
      navigate('/dashboard')
      return
    }
    loadBlocks()
  }, [])

  const loadBlocks = async () => {
    const { data } = await supabase
      .from('experience_blocks')
      .select('*')
      .eq('user_id', user.id)
    setAllBlocks(data || [])
  }

  if (!savedBlock) return null

  const cat = CATEGORIES.find(c => c.id === savedBlock.category)
  const strengthStars = (score) =>
    Array.from({ length: 5 }, (_, i) => (i < score ? '\u2605' : '\u2606')).join('')

  // 역량 커버리지 계산
  const coveredTags = new Set()
  allBlocks.forEach(block => {
    (block.tags || []).forEach(tag => {
      const match = mapTagToCompetency(tag)
      if (match) coveredTags.add(match.id)
    })
  })
  const uncoveredTags = COMPETENCY_TAGS.filter(t => !coveredTags.has(t.id))

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      {/* 성취 헤더 */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">✨</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">경험 블록이 저장되었습니다!</h1>
        <p className="text-sm text-slate-500">당신의 경험이 취업 무기가 되었어요.</p>
      </div>

      {/* 저장된 블록 요약 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{cat?.emoji}</span>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{cat?.label}</span>
          <span className="text-sm text-amber-500 ml-auto">{strengthStars(savedBlock.strength_score)}</span>
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-2">{savedBlock.title}</h2>
        <div className="flex flex-wrap gap-1.5">
          {savedBlock.tags?.map((tag, i) => (
            <span key={i} className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>
      </div>

      {/* 업종/직무 추천 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h3 className="text-sm font-bold text-slate-900 mb-3">이 경험이 특히 통하는 곳</h3>
        {loadingRec ? (
          <div className="flex items-center gap-2 py-4">
            <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-400">AI가 분석 중...</span>
          </div>
        ) : recommendation ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {recommendation.industries?.map((ind, i) => (
                <div key={i} className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex-1 min-w-[140px]">
                  <div className="text-sm font-medium text-blue-800">{ind.name}</div>
                  <div className="text-xs text-blue-600 mt-0.5">{ind.reason}</div>
                </div>
              ))}
            </div>
            {recommendation.roles?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {recommendation.roles.map((role, i) => (
                  <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{role}</span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-2">추천 정보를 불러오지 못했습니다.</p>
        )}
      </div>

      {/* 내 블록 현황 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h3 className="text-sm font-bold text-slate-900 mb-3">내 블록 현황</h3>
        <div className="flex items-center gap-4 mb-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600">{allBlocks.length}</div>
            <div className="text-xs text-slate-500">보유 블록</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{coveredTags.size}</div>
            <div className="text-xs text-slate-500">커버 역량</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-500">{uncoveredTags.length}</div>
            <div className="text-xs text-slate-500">부족 역량</div>
          </div>
        </div>
        {uncoveredTags.length > 0 && (
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
            <div className="text-xs text-amber-700 mb-1.5 font-medium">아직 커버되지 않은 역량</div>
            <div className="flex flex-wrap gap-1.5">
              {uncoveredTags.map(t => (
                <span key={t.id} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{t.label}</span>
              ))}
            </div>
          </div>
        )}
        {allBlocks.length < 3 && (
          <p className="text-xs text-slate-500 mt-3">
            블록이 3개 이상이면 자소서의 다양한 문항에 대응할 수 있어요.
          </p>
        )}
      </div>

      {/* CTA 버튼들 */}
      <div className="space-y-3">
        <Link
          to="/cover-letter"
          className="block w-full py-3.5 bg-primary-600 text-white rounded-xl text-center text-sm font-medium hover:bg-primary-700 no-underline shadow-lg shadow-primary-600/25"
        >
          이 블록으로 자소서 쓰기
        </Link>
        <Link
          to="/interview"
          className="block w-full py-3 bg-white text-slate-700 rounded-xl text-center text-sm font-medium border border-slate-200 hover:bg-slate-50 no-underline"
        >
          블록 더 만들기 {allBlocks.length < 3 && '(3개 이상 추천)'}
        </Link>
        <Link
          to="/dashboard"
          className="block w-full py-3 text-slate-400 text-center text-sm hover:text-slate-600 no-underline"
        >
          대시보드로 가기
        </Link>
      </div>
    </div>
  )
}
