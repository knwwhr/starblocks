import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  MessageCircle, MapPin, Zap, Target, Lightbulb, Sparkles,
  Plus, FileText, Pencil, Trash2, Search, ChevronDown, ChevronRight,
  Briefcase,
} from 'lucide-react'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../config/supabase'
import {
  CATEGORIES, COMPETENCY_TAGS, CATEGORY_GROUPS,
  mapTagToCompetency, getCategoryGroup,
} from '../config/categories'
import { useToast } from '../contexts/ToastContext'
import { Card } from '../components/ui/Card'
import { StrengthStars } from '../components/ui/StrengthStars'
import { recommendIndustries } from '../lib/coverLetterEngine'

function isEmptyRec(rec) {
  if (!rec || typeof rec !== 'object') return true
  const noInd = !Array.isArray(rec.industries) || rec.industries.length === 0
  const noRoles = !Array.isArray(rec.roles) || rec.roles.length === 0
  return noInd && noRoles
}

const FREE_BLOCKS_LIMIT = 3

const STAR_FIELDS = [
  { key: 'situation', label: '상황',   Icon: MapPin },
  { key: 'action',    label: '행동',   Icon: Zap },
  { key: 'result',    label: '결과',   Icon: Target },
  { key: 'lesson',    label: '배운점', Icon: Lightbulb },
]

// ───────────── 인터뷰 이력 (블록 풀뷰 안에서 사용) ─────────────
function InterviewTranscript({ blockId }) {
  const [messages, setMessages] = useState(null)
  const [loading, setLoading] = useState(true)
  const [show, setShow] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .from('interview_sessions')
      .select('messages')
      .eq('block_id', blockId)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        setMessages(data?.messages || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [blockId])

  if (loading) return <div className="text-xs text-slate-400">대화 불러오는 중...</div>
  if (!messages || messages.length === 0) return null

  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
      <button
        onClick={() => setShow(!show)}
        className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 w-full justify-between"
      >
        <span className="inline-flex items-center gap-1.5">
          <MessageCircle size={12} strokeWidth={2.2} />
          인터뷰 대화 보기 ({messages.length}개 메시지)
        </span>
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

// ───────────── HeroZone: 역량 레이더 + 다음 카테고리 추천 + 이번 달 사용량 ─────────────

function competencyData(blocks) {
  const counts = {}
  COMPETENCY_TAGS.forEach(t => { counts[t.id] = 0 })
  blocks.forEach(b => {
    const seen = new Set()
    ;(b.tags || []).forEach(tag => {
      const m = mapTagToCompetency(tag)
      if (m && !seen.has(m.id)) { counts[m.id]++; seen.add(m.id) }
    })
  })
  return COMPETENCY_TAGS.map(t => ({
    competency: t.label, value: counts[t.id], fullMark: Math.max(blocks.length, 3),
  }))
}

function CompetencyRadar({ blocks }) {
  const data = useMemo(() => competencyData(blocks), [blocks])
  return (
    <Card className="p-4 h-full">
      <h3 className="text-sm font-bold text-slate-900 mb-1">역량 레이더</h3>
      <p className="text-xs text-slate-500 mb-2">10개 표준 역량의 커버리지</p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="competency" tick={{ fill: '#64748b', fontSize: 10 }} />
            <Radar dataKey="value" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.25} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function suggestNextCategory(blocks) {
  // 가장 부족한 역량 → 그 역량에 어울리는 카테고리 추천 (휴리스틱)
  const counts = {}
  COMPETENCY_TAGS.forEach(t => { counts[t.id] = 0 })
  blocks.forEach(b => {
    const seen = new Set()
    ;(b.tags || []).forEach(tag => {
      const m = mapTagToCompetency(tag)
      if (m && !seen.has(m.id)) { counts[m.id]++; seen.add(m.id) }
    })
  })
  const weakest = COMPETENCY_TAGS
    .map(t => ({ ...t, count: counts[t.id] }))
    .sort((a, b) => a.count - b.count)[0]

  // 카테고리별 약한 역량 매핑 (간단 휴리스틱)
  const COMP_TO_CAT = {
    leadership: 'team_project',
    teamwork: 'team_project',
    problem_solving: 'competition',
    technical: 'personal_project',
    self_driven: 'personal_project',
    creativity: 'competition',
    resilience: 'overseas',
    communication: 'club_activity',
    analytical: 'internship',
    adaptability: 'overseas',
  }
  const usedCats = new Set(blocks.map(b => b.category))
  // 추천 카테고리: 약한 역량 매핑 → 아직 안 만들었으면 그것, 이미 있으면 다른 약한 역량을 시도
  for (const t of COMPETENCY_TAGS.slice().sort((a, b) => counts[a.id] - counts[b.id])) {
    const catId = COMP_TO_CAT[t.id]
    if (catId && !usedCats.has(catId)) {
      return { competency: t, category: CATEGORIES.find(c => c.id === catId) }
    }
  }
  return { competency: weakest, category: null }
}

function NextCategoryCard({ blocks }) {
  const { competency, category } = useMemo(() => suggestNextCategory(blocks), [blocks])
  return (
    <Card className="p-4 h-full">
      <h3 className="text-sm font-bold text-slate-900 mb-1 inline-flex items-center gap-1.5">
        <Sparkles size={14} strokeWidth={2.2} className="text-amber-500" />
        다음에 만들면 좋은 블록
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        가장 비어있는 역량은 <span className="font-bold text-slate-700">{competency.label}</span>이에요.
      </p>
      {category ? (
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{category.emoji}</span>
            <span className="text-sm font-bold text-slate-900">{category.label}</span>
          </div>
          <p className="text-xs text-slate-500 mb-3">{category.description}</p>
          <Link
            to="/interview"
            className="inline-flex items-center gap-1 text-xs bg-primary-600 text-white px-3 py-1.5 rounded-md font-medium hover:bg-primary-700 no-underline"
          >
            <Plus size={12} strokeWidth={2.5} />
            이 카테고리로 만들기
          </Link>
        </div>
      ) : (
        <p className="text-xs text-slate-400">모든 카테고리에 블록을 갖고 있어요. 강도 높은 경험을 더 추가해보세요.</p>
      )}
    </Card>
  )
}

function UsageCard({ usage }) {
  const used = usage?.blocks_created ?? 0
  const limit = FREE_BLOCKS_LIMIT
  const pct = Math.min(100, (used / limit) * 100)
  const plan = usage?.plan ?? 'free'

  return (
    <Card className="p-4 h-full">
      <h3 className="text-sm font-bold text-slate-900 mb-1">이번 달 사용량</h3>
      <p className="text-xs text-slate-500 mb-3">
        플랜: <span className="font-medium text-slate-700">{plan === 'free' ? '무료' : plan}</span>
      </p>
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-500">블록 생성</span>
            <span className="font-medium text-slate-700">
              {used} / {plan === 'free' ? limit : '∞'}
            </span>
          </div>
          <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                used >= limit && plan === 'free' ? 'bg-red-400' : 'bg-primary-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-500">자소서 생성</span>
            <span className="font-medium text-slate-700">
              {usage?.cover_letters_generated ?? 0} / {plan === 'free' ? '1' : '∞'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ───────────── Notion 패널: 좌 리스트 / 우 풀뷰 ─────────────

function BlockListItem({ block, selected, onSelect }) {
  const cat = CATEGORIES.find(c => c.id === block.category)
  const group = getCategoryGroup(block.category)
  return (
    <button
      onClick={() => onSelect(block.id)}
      className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all ${
        selected
          ? 'border-primary-300 bg-primary-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`inline-block w-1 h-3.5 rounded-sm ${group?.bar || 'bg-slate-300'}`} aria-hidden />
        <span className="text-xs" aria-hidden>{cat?.emoji}</span>
        <span className="text-[11px] text-slate-500 truncate">{cat?.label}</span>
        <StrengthStars score={block.strength_score} size={10} className="ml-auto" />
      </div>
      <div className="text-sm font-medium text-slate-900 truncate">{block.title}</div>
      <div className="text-[11px] text-slate-400 mt-0.5">
        {new Date(block.created_at).toLocaleDateString('ko-KR')}
      </div>
    </button>
  )
}

function BlockFullView({ block, onDelete }) {
  const cat = CATEGORIES.find(c => c.id === block.category)
  const group = getCategoryGroup(block.category)

  return (
    <Card accentBar={group?.bar} className="pl-1">
      <div className="px-6 py-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-base" aria-hidden>{cat?.emoji}</span>
              <span className={`text-xs ${group?.text || 'text-slate-500'} ${group?.soft || 'bg-slate-100'} px-2 py-0.5 rounded-full font-medium`}>
                {cat?.label}
              </span>
              <StrengthStars score={block.strength_score} size={12} />
              <span className="text-xs text-slate-400">
                {new Date(block.created_at).toLocaleDateString('ko-KR')}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">{block.title}</h2>
            <div className="flex flex-wrap gap-1 mt-2">
              {block.tags?.map((tag, i) => (
                <span key={i} className="text-xs bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Link
              to={`/block/${block.id}/edit`}
              className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 hover:bg-primary-50 px-2 py-1.5 rounded-md no-underline"
            >
              <Pencil size={12} strokeWidth={2} />
              수정
            </Link>
            <button
              onClick={() => onDelete(block.id)}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-md"
            >
              <Trash2 size={12} strokeWidth={2} />
              삭제
            </button>
          </div>
        </div>

        <div className="space-y-3 mt-4">
          {STAR_FIELDS.map(({ key, label, Icon }) => (
            <div key={key}>
              <div className="text-xs font-bold text-slate-400 mb-1 inline-flex items-center gap-1">
                <Icon size={12} strokeWidth={2.2} />
                {label}
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{block[key]}</p>
            </div>
          ))}

          {block.ai_insight && (
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
              <div className="text-xs font-bold text-amber-700 mb-1 inline-flex items-center gap-1">
                <Sparkles size={12} strokeWidth={2.2} />
                AI 인사이트
              </div>
              <p className="text-sm text-amber-900">{block.ai_insight}</p>
            </div>
          )}

          {block.recommended_questions?.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-400 mb-1.5">추천 면접 문항</div>
              <div className="flex flex-wrap gap-1">
                {block.recommended_questions.map((q, i) => (
                  <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{q}</span>
                ))}
              </div>
            </div>
          )}

          <InterviewTranscript blockId={block.id} />
        </div>
      </div>
    </Card>
  )
}

// ───────────── 업종/직무 추천 (collapsible) ─────────────
function IndustryRecommendations({ blocks }) {
  const [open, setOpen] = useState(false)
  const industryMap = new Map()
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

  const topIndustries = [...industryMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5)
  const topRoles = [...roleMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)

  if (topIndustries.length === 0 && topRoles.length === 0) return null

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50"
      >
        <span className="text-sm font-bold text-slate-900 inline-flex items-center gap-1.5">
          <Briefcase size={14} strokeWidth={2.2} className="text-blue-600" />
          내 경험이 통하는 곳 (업종/직무 추천)
        </span>
        {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-slate-100 pt-3">
          {topIndustries.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-500 mb-2">추천 업종</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {topIndustries.map(([name, data]) => (
                  <div key={name} className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-800">{name}</span>
                      {data.count > 1 && (<span className="text-xs text-blue-400">×{data.count}</span>)}
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
                  <span key={role} className="text-xs bg-blue-50 border border-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
                    {role} {count > 1 && <span className="text-blue-400">×{count}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ───────────── 페이지 본체 ─────────────

const SORT_OPTIONS = [
  { id: 'recent',   label: '최근 수정순' },
  { id: 'oldest',   label: '오래된 순' },
  { id: 'strength', label: '강도 높은 순' },
]

export default function DashboardPage() {
  const { user } = useAuth()
  const [blocks, setBlocks] = useState([])
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')
  const [sort, setSort] = useState('recent')
  const toast = useToast()

  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user])

  const loadAll = async () => {
    setLoading(true)
    const month = new Date().toISOString().slice(0, 7)
    const [blocksRes, usageRes] = await Promise.all([
      supabase
        .from('experience_blocks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('usage_counters')
        .select('blocks_created, cover_letters_generated, plan')
        .eq('user_id', user.id)
        .eq('month', month)
        .maybeSingle(),
    ])
    if (!blocksRes.error) {
      const list = blocksRes.data || []
      setBlocks(list)
      if (list.length && !selectedId) setSelectedId(list[0].id)
      // 업종 추천이 비어있는 블록을 백그라운드로 lazy 채우기
      retryEmptyRecommendations(list)
    }
    if (!usageRes.error) setUsage(usageRes.data)
    setLoading(false)
  }

  // 백그라운드: recommended_industries가 비어있는 블록을 순차 재호출
  const retryEmptyRecommendations = (list) => {
    const targets = list.filter(b => isEmptyRec(b.recommended_industries))
    if (targets.length === 0) return
    ;(async () => {
      for (const block of targets) {
        try {
          const rec = await recommendIndustries(block)
          if (isEmptyRec(rec)) continue
          await supabase
            .from('experience_blocks')
            .update({ recommended_industries: rec })
            .eq('id', block.id)
          setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, recommended_industries: rec } : b))
        } catch (e) {
          console.warn('Recommendation retry failed:', e)
        }
      }
    })()
  }

  const handleDelete = async (id) => {
    if (!confirm('이 블록을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('experience_blocks').delete().eq('id', id)
    if (error) {
      toast.error('삭제에 실패했습니다.')
    } else {
      setBlocks(prev => prev.filter(b => b.id !== id))
      if (selectedId === id) {
        setSelectedId(prev => {
          const remaining = blocks.filter(b => b.id !== id)
          return remaining[0]?.id || null
        })
      }
      toast.success('블록이 삭제되었습니다.')
    }
  }

  const filteredBlocks = useMemo(() => {
    let arr = blocks
    if (groupFilter !== 'all') arr = arr.filter(b => {
      const cat = CATEGORIES.find(c => c.id === b.category)
      return cat?.group === groupFilter
    })
    if (search.trim()) {
      const q = search.toLowerCase()
      arr = arr.filter(b =>
        b.title?.toLowerCase().includes(q) ||
        b.situation?.toLowerCase().includes(q) ||
        (b.tags || []).some(t => t.toLowerCase().includes(q))
      )
    }
    if (sort === 'oldest') arr = [...arr].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    else if (sort === 'strength') arr = [...arr].sort((a, b) => (b.strength_score || 0) - (a.strength_score || 0))
    return arr
  }, [blocks, search, groupFilter, sort])

  const selectedBlock = blocks.find(b => b.id === selectedId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-slate-400">불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">내 경험 블록</h1>
          <p className="text-sm text-slate-500">{blocks.length}개의 블록</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/cover-letter"
            className="inline-flex items-center gap-1.5 text-primary-600 border border-primary-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-50 no-underline"
          >
            <FileText size={14} strokeWidth={2} />
            자소서 쓰기
          </Link>
          <Link
            to="/interview"
            className="inline-flex items-center gap-1.5 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 no-underline shadow-sm"
          >
            <Plus size={14} strokeWidth={2.5} />
            새 블록 만들기
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
            className="inline-flex items-center gap-1.5 bg-primary-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-700 no-underline shadow-sm"
          >
            <Plus size={14} strokeWidth={2.5} />
            첫 블록 만들기
          </Link>
        </div>
      ) : (
        <>
          {/* HeroZone — 3 컬럼 (모바일 1컬럼) */}
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1"><CompetencyRadar blocks={blocks} /></div>
            <div className="lg:col-span-1"><NextCategoryCard blocks={blocks} /></div>
            <div className="lg:col-span-1"><UsageCard usage={usage} /></div>
          </div>

          {/* Notion 패널 — 좌 리스트 / 우 풀뷰 */}
          <div className="grid lg:grid-cols-3 gap-4">
            {/* 좌: 검색·필터·리스트 */}
            <div className="lg:col-span-1 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="블록 검색..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="all">전체 카테고리</option>
                  {Object.entries(CATEGORY_GROUPS).map(([id, g]) => (
                    <option key={id} value={id}>{g.label}</option>
                  ))}
                </select>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 max-h-[calc(100vh-22rem)] overflow-y-auto pr-1">
                {filteredBlocks.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-8">
                    검색 결과가 없어요
                  </div>
                ) : (
                  filteredBlocks.map(b => (
                    <BlockListItem
                      key={b.id}
                      block={b}
                      selected={b.id === selectedId}
                      onSelect={setSelectedId}
                    />
                  ))
                )}
              </div>
            </div>

            {/* 우: 풀뷰 */}
            <div className="lg:col-span-2">
              {selectedBlock ? (
                <BlockFullView block={selectedBlock} onDelete={handleDelete} />
              ) : (
                <Card className="p-8 text-center text-sm text-slate-400">
                  좌측에서 블록을 선택하세요
                </Card>
              )}
            </div>
          </div>

          {/* 업종/직무 (collapsible) */}
          <IndustryRecommendations blocks={blocks} />
        </>
      )}
    </div>
  )
}
