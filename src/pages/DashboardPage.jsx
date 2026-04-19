import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../config/supabase'
import { CATEGORIES, COMPETENCY_TAGS, mapTagToCompetency } from '../config/categories'
import { useToast } from '../contexts/ToastContext'

function InterviewTranscript({ blockId }) {
  const [messages, setMessages] = useState(null)
  const [loading, setLoading] = useState(true)
  const [show, setShow] = useState(false)

  useEffect(() => {
    supabase
      .from('interview_sessions')
      .select('messages')
      .eq('block_id', blockId)
      .single()
      .then(({ data }) => {
        setMessages(data?.messages || [])
        setLoading(false)
      })
  }, [blockId])

  if (loading) return <div className="text-xs text-slate-400">대화 불러오는 중...</div>
  if (!messages || messages.length === 0) return null

  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
      <button
        onClick={(e) => { e.stopPropagation(); setShow(!show) }}
        className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 w-full justify-between"
      >
        <span>💬 인터뷰 대화 보기 ({messages.length}개 메시지)</span>
        <span className="text-slate-400">{show ? '접기' : '펼치기'}</span>
      </button>
      {show && (
        <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] text-xs px-3 py-2 rounded-lg whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-primary-100 text-primary-900'
                  : 'bg-white border border-slate-200 text-slate-700'
              }`}>
                {m.content?.replace(/<block_json>[\s\S]*?<\/block_json>/g, '').trim() || m.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BlockCard({ block, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const cat = CATEGORIES.find(c => c.id === block.category)

  const strengthStars = (score) =>
    Array.from({ length: 5 }, (_, i) => (i < score ? '\u2605' : '\u2606')).join('')

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
      <div
        className="px-5 py-4 cursor-pointer hover:bg-slate-50 transition"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{cat?.emoji || '📦'}</span>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{cat?.label}</span>
            <span className="text-xs text-amber-500">{strengthStars(block.strength_score)}</span>
          </div>
          <span className="text-xs text-slate-400">
            {new Date(block.created_at).toLocaleDateString('ko-KR')}
          </span>
        </div>
        <h3 className="text-sm font-bold text-slate-900 mt-1">{block.title}</h3>
        <div className="flex flex-wrap gap-1 mt-2">
          {block.tags?.map((tag, i) => (
            <span key={i} className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-4 border-t border-slate-100 pt-3 space-y-3">
          {[
            { label: '상황', value: block.situation, icon: '📍' },
            { label: '행동', value: block.action, icon: '⚡' },
            { label: '결과', value: block.result, icon: '🎯' },
            { label: '배운점', value: block.lesson, icon: '💡' },
          ].map(({ label, value, icon }) => (
            <div key={label}>
              <div className="text-xs font-bold text-slate-400 mb-0.5">{icon} {label}</div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{value}</p>
            </div>
          ))}

          {block.ai_insight && (
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
              <div className="text-xs font-bold text-amber-700 mb-1">AI 인사이트</div>
              <p className="text-sm text-amber-900">{block.ai_insight}</p>
            </div>
          )}

          {block.recommended_questions?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {block.recommended_questions.map((q, i) => (
                <span key={i} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{q}</span>
              ))}
            </div>
          )}

          <InterviewTranscript blockId={block.id} />

          <div className="flex justify-end pt-2 gap-3">
            <Link
              to={`/block/${block.id}/edit`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-primary-600 hover:text-primary-800 no-underline"
            >
              수정
            </Link>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(block.id) }}
              className="text-xs text-red-400 hover:text-red-600"
            >
              삭제
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function IndustryRecommendations({ blocks }) {
  // 모든 블록의 추천 업종/직무를 집계 (빈도순)
  const industryMap = new Map() // name → { count, reasons: Set }
  const roleMap = new Map()

  blocks.forEach(block => {
    const rec = block.recommended_industries
    if (!rec || typeof rec !== 'object') return

    ;(rec.industries || []).forEach(ind => {
      if (!ind?.name) return
      const existing = industryMap.get(ind.name) || { count: 0, reasons: new Set() }
      existing.count++
      if (ind.reason) existing.reasons.add(ind.reason)
      industryMap.set(ind.name, existing)
    })

    ;(rec.roles || []).forEach(role => {
      roleMap.set(role, (roleMap.get(role) || 0) + 1)
    })
  })

  const topIndustries = [...industryMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
  const topRoles = [...roleMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  if (topIndustries.length === 0 && topRoles.length === 0) return null

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-5 mb-6">
      <h3 className="text-sm font-bold text-slate-900 mb-1">✨ 내 경험이 통하는 곳</h3>
      <p className="text-xs text-slate-500 mb-4">지금까지 만든 블록을 종합해 추천한 업종과 직무예요</p>

      {topIndustries.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-bold text-slate-500 mb-2">추천 업종</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {topIndustries.map(([name, data]) => (
              <div key={name} className="bg-white border border-blue-100 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800">{name}</span>
                  {data.count > 1 && (
                    <span className="text-xs text-blue-400">×{data.count}</span>
                  )}
                </div>
                {[...data.reasons][0] && (
                  <div className="text-xs text-blue-600 mt-0.5 line-clamp-1">{[...data.reasons][0]}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {topRoles.length > 0 && (
        <div>
          <div className="text-xs font-bold text-slate-500 mb-2">추천 직무</div>
          <div className="flex flex-wrap gap-1.5">
            {topRoles.map(([role, count]) => (
              <span key={role} className="text-xs bg-white border border-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                {role} {count > 1 && <span className="text-blue-400">×{count}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CompetencyCoverage({ blocks }) {
  const tagCounts = {}
  COMPETENCY_TAGS.forEach(t => { tagCounts[t.label] = 0 })

  blocks.forEach(block => {
    const seenInBlock = new Set()
    ;(block.tags || []).forEach(tag => {
      const match = mapTagToCompetency(tag)
      if (match && !seenInBlock.has(match.id)) {
        tagCounts[match.label]++
        seenInBlock.add(match.id)
      }
    })
  })

  const maxCount = Math.max(...Object.values(tagCounts), 1)

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-bold text-slate-900 mb-4">역량 커버리지</h3>
      <div className="space-y-2.5">
        {COMPETENCY_TAGS.map(tag => {
          const count = tagCounts[tag.label]
          const pct = (count / maxCount) * 100
          return (
            <div key={tag.id} className="flex items-center gap-3">
              <span className="text-xs text-slate-600 w-20 shrink-0">{tag.label}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-slate-400 w-6 text-right">{count}</span>
            </div>
          )
        })}
      </div>
      {blocks.length > 0 && Object.values(tagCounts).some(v => v === 0) && (
        <p className="text-xs text-amber-600 mt-4 bg-amber-50 p-2 rounded-lg">
          커버되지 않은 역량이 있어요. 관련 경험을 추가해보세요!
        </p>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    if (!user) return
    loadBlocks()
  }, [user])

  const loadBlocks = async () => {
    const { data, error } = await supabase
      .from('experience_blocks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error) setBlocks(data || [])
    setLoading(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('이 블록을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('experience_blocks').delete().eq('id', id)
    if (error) {
      toast.error('삭제에 실패했습니다.')
    } else {
      setBlocks(prev => prev.filter(b => b.id !== id))
      toast.success('블록이 삭제되었습니다.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-slate-400">불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">내 경험 블록</h1>
          <p className="text-sm text-slate-500">{blocks.length}개의 블록</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/cover-letter"
            className="text-primary-600 border border-primary-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-50 no-underline"
          >
            자소서 쓰기
          </Link>
          <Link
            to="/interview"
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 no-underline"
          >
            + 새 블록 만들기
          </Link>
        </div>
      </div>

      {blocks.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">📦</div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">아직 경험 블록이 없어요</h2>
          <p className="text-sm text-slate-500 mb-6">AI와 5분 대화하면 첫 블록을 만들 수 있습니다.</p>
          <Link
            to="/interview"
            className="inline-block bg-primary-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 no-underline"
          >
            첫 블록 만들기
          </Link>
        </div>
      ) : (
        <>
          <IndustryRecommendations blocks={blocks} />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {blocks.map(block => (
              <BlockCard key={block.id} block={block} onDelete={handleDelete} />
            ))}
          </div>
          <div>
            <CompetencyCoverage blocks={blocks} />
          </div>
        </div>
        </>
      )}
    </div>
  )
}
